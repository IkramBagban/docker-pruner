const core = require("@actions/core");
const { exec } = require("child_process");
const os = require("os");
const path = require("path");

function generateSSHScriptCommand(script, keyContent, username, host) {
  if (!username.match(/^[a-zA-Z0-9_-]+$/) || !host.match(/^[a-zA-Z0-9.-]+$/)) {
    throw new Error("Invalid username or host");
  }
  const keyPath = path.join(os.tmpdir(), "vm_key.pem");

  return `cat << 'KEY_EOF' > ${keyPath}
${keyContent}
KEY_EOF
chmod 600 ${keyPath}
ssh -i ${keyPath} -o StrictHostKeyChecking=no ${username}@${host} 'bash -s' << 'EOF'
${script}
EOF
rm -f ${keyPath}`;
}

(async () => {
  try {
    const host = core.getInput("host", { required: true });
    const username = core.getInput("username", { required: true });
    const key = core.getInput("key", { required: true });

    if (!key.includes("PRIVATE KEY")) {
      throw new Error("Invalid SSH private key");
    }

    const thresholdDaysInput = core.getInput("thresholdDays");
    const thresholdDays = thresholdDaysInput
      ? parseInt(thresholdDaysInput)
      : null;

    if (
      thresholdDays !== null &&
      (isNaN(thresholdDays) || thresholdDays <= 0)
    ) {
      throw new Error("thresholdDays must be a positive integer");
    }

    const thresholdSeconds = thresholdDays ? thresholdDays * 24 * 60 * 60 : 0;

    const cleanupScript = `
# 1) Prune dangling images
docker image prune -f --filter 'dangling=true'

# 2) Remove exited containers older than threshold
docker ps -a --format '{{.ID}}' | while read -r id; do
  created=\$(docker inspect --format='{{.Created}}' "\$id" | cut -d. -f1)
  createdSec=\$(date -d "\$created" +%s 2>/dev/null) || { echo "Skip \$id: bad date"; continue; }
  age=\$(( \$(date +%s) - createdSec ))
  status=\$(docker inspect --format='{{.State.Status}}' "\$id")
  if [ "\$status" = "exited" ] && [ "\$age" -gt ${thresholdSeconds} ]; then
    echo "Removing stopped container \$id (age=\${age}s)"
    docker rm -f "\$id" || true
  fi
done

# 3) Remove unused images older than threshold
docker images --format '{{.ID}} {{.Repository}}:{{.Tag}}' | while read -r id repo; do
  created=\$(docker inspect --format='{{.Created}}' "\$id" | cut -d. -f1)
  createdSec=\$(date -d "\$created" +%s 2>/dev/null) || { echo "Skip image \$id: bad date"; continue; }
  age=\$(( \$(date +%s) - createdSec ))
  inUse=\$(docker ps -a --filter "ancestor=\$id" --format '{{.ID}}')
  if [ -z "\$inUse" ] && [ "\$age" -gt ${thresholdSeconds} ]; then
    echo "Removing unused image \$repo (age=\${age}s)"
    docker rmi -f "\$id" || true
  fi
done
`;

    core.info("Generated cleanup script:");
    core.info(cleanupScript);

    const sshScript = generateSSHScriptCommand(
      cleanupScript,
      key.trim(),
      username,
      host
    );

    core.info("Executing remote cleanup via SSH...");

    exec(sshScript, (error, stdout, stderr) => {
      if (error) {
        core.setFailed(`SSH Command failed: ${error.message}`);
        return;
      }
      core.info(`STDOUT:\n${stdout}`);
      if (stderr) core.error(`STDERR:\n${stderr}`);
    });
  } catch (err) {
    core.setFailed(err.message);
  }
})();
