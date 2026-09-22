+++
date = "2026-03-27"
title = "Go: Convenções de nomes de arquivo para SO e arquitetura"
tags = ["go", "til", "golang", "build"]
+++

### Arquivos específicos de sistema operacional

O Go inclui arquivos no build de acordo com sufixos no nome do arquivo que correspondem ao sistema operacional de destino.

```go
file_linux.go     // only built on Linux
file_windows.go   // only built on Windows
file_darwin.go    // only built on macOS
```

**Sufixos de sistema operacional suportados:**

```
_aix.go
_android.go
_darwin.go
_dragonfly.go
_freebsd.go
_illumos.go
_ios.go
_js.go
_linux.go
_netbsd.go
_openbsd.go
_plan9.go
_solaris.go
_wasip1.go
_windows.go
```

### Arquivos específicos de arquitetura

Da mesma forma, o Go seleciona arquivos de acordo com a arquitetura de CPU usando sufixos:

```go
math_amd64.go   // only built on amd64
math_arm64.go   // only built on arm64
```

**Sufixos de arquitetura suportados:**

```
_386.go
_amd64.go
_arm.go
_arm64.go
_loong64.go
_mips.go
_mips64.go
_mips64le.go
_mipsle.go
_ppc64.go
_ppc64le.go
_riscv64.go
_s390x.go
_wasm.go
```

### Sistema operacional + arquitetura combinados

Você pode combinar sistema operacional e arquitetura no mesmo nome de arquivo:

```go
syscall_linux_amd64.go   // only Linux on amd64
syscall_windows_arm64.go // only Windows on arm64
```

### Observações

- O Go seleciona automaticamente os arquivos corretos durante o build (`go build`, `go run`, etc.).
- Não é preciso configurar nada manualmente — isso faz parte do sistema de build do Go.
- Útil para syscalls específicas de plataforma, otimizações ou diferenças de comportamento.
- É uma alternativa às build tags (`//go:build`), mas os dois costumam ser usados juntos para um controle mais fino.

### Exemplo de caso de uso

```go
// file: path_unix.go
//go:build linux || darwin

func getPath() string {
    return "/usr/local/bin"
}
```

```go
// file: path_windows.go

func getPath() string {
    return "C:\\Program Files"
}
```
