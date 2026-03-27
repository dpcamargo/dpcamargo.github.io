+++
date = "2026-03-27"
title = "Go: File Naming Conventions for OS and Architecture"
tags = ["go", "til", "golang", "build"]
+++

### OS-Specific Files

Go includes files in the build based on filename suffixes that match the target operating system.

```go
file_linux.go     // only built on Linux
file_windows.go   // only built on Windows
file_darwin.go    // only built on macOS
```

**Supported OS suffixes:**

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

### Architecture-Specific Files

Similarly, Go selects files based on CPU architecture using suffixes:

```go
math_amd64.go   // only built on amd64
math_arm64.go   // only built on arm64
```

**Supported architecture suffixes:**

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

### Combined OS + Architecture

You can combine both OS and architecture in the same filename:

```go
syscall_linux_amd64.go   // only Linux on amd64
syscall_windows_arm64.go // only Windows on arm64
```

### Notes

- Go automatically selects the correct files during build (`go build`, `go run`, etc.).
- No need for manual configuration—this is part of Go’s build system.
- Useful for platform-specific syscalls, optimizations, or behavior differences.
- Alternative to build tags (`//go:build`), but often used together for finer control.

### Example Use Case

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