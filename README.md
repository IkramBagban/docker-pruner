# Docker VM Cleanup GitHub Action

This GitHub Action allows you to **remotely SSH into a Virtual Machine (VM)** and clean up **unused Docker containers and images**. It’s useful for maintaining Docker hygiene on your infrastructure by removing stopped containers and dangling or unused images.

---

## About This Action

This action performs the following tasks **on your remote VM** via SSH:

1. Prunes all **dangling Docker images**.
2. Removes all **exited containers** older than a specified number of days.
3. Removes **unused images** (not associated with any running or stopped container) that are older than the specified number of days.

---

## ⚙️ Inputs

| Name           | Required | Description                                                                 |
|----------------|----------|-----------------------------------------------------------------------------|
| `host`         | ✅       | IP or domain of your VM.                                                    |
| `username`     | ✅       | SSH username for the VM.                                                    |
| `key`          | ✅       | SSH private key (should include `PRIVATE KEY`).                             |
| `thresholdDays`| ❌       | Number of days to use as threshold for deletion. Must be a positive integer.|

---

## Default Behavior

If `thresholdDays` is **not provided**, the action will:

- Prune **dangling Docker images**.
- Remove **only exited containers** (regardless of age).
- Remove **only unused images** (regardless of age).

This ensures that the cleanup still occurs with a basic level of hygiene even when `thresholdDays` is omitted.

---

## How to Use

1. **Create GitHub Secrets** for your VM credentials:

- `VM_HOST`: Your VM IP or domain.
- `VM_USERNAME`: SSH username.
- `VM_SSH_KEY`: The private SSH key.

2. **Create your GitHub Action Workflow** (e.g., `.github/workflows/cleanup.yml`):

```yaml
name: "Docker Cleanup Cron"

on:
  push:
  schedule:
    - cron: '0 0 * * *' # Runs every day at midnight UTC

jobs:
  docker-cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Run Docker Cleanup
        uses: ikrambagban/docker-pruner@v1
        with:
          host: ${{ secrets.VM_HOST }}
          username: ${{ secrets.VM_USERNAME }}
          key: ${{ secrets.VM_SSH_KEY }}
          thresholdDays: 10
