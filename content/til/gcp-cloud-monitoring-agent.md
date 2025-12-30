+++
date = '2025-12-29T16:56:40-03:00'
title = 'GCP: Installing Cloud Monitoring and Logging Agent'
tags = ["gcp", "til", "monitoring", "ops"]
+++

Today I learned how to install the Google Cloud Operations agent on a GCP VM instance to enable Cloud Monitoring and Logging.

## Install the Cloud Monitoring Agent

Run the Monitoring agent install script command in the SSH terminal of your VM instance:

```sh
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install
```

If asked if you want to continue, press `Y`.

## Verify Installation

Check the status of the Google Cloud Operations agent:

```sh
sudo systemctl status google-cloud-ops-agent"*"
```

## References

[Google Cloud Operations Agent Documentation](https://cloud.google.com/stackdriver/docs/solutions/agents/ops-agent)
