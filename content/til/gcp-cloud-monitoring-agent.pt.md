+++
date = '2025-12-29T16:56:40-03:00'
title = 'GCP: Instalando o agente de Cloud Monitoring e Logging'
tags = ["gcp", "til", "monitoring", "ops"]
+++

Hoje eu aprendi a instalar o agente do Google Cloud Operations em uma instância de VM do GCP para habilitar o Cloud Monitoring e o Logging.

## Instale o agente do Cloud Monitoring

Execute o comando do script de instalação do agente de Monitoring no terminal SSH da sua instância de VM:

```sh
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install
```

Se perguntar se você quer continuar, pressione `Y`.

## Verifique a instalação

Confira o status do agente do Google Cloud Operations:

```sh
sudo systemctl status google-cloud-ops-agent"*"
```

## Referências

[Documentação do agente do Google Cloud Operations](https://cloud.google.com/stackdriver/docs/solutions/agents/ops-agent)
