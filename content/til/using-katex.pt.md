+++
date = '2025-06-08T22:37:23-03:00'
title = 'Usando o KaTeX'
tags = ["ml", "math"]
math = true
+++

Usando o [KaTeX](https://katex.org/) para representar matrizes e expressões matemáticas.

## Matriz:

{{< math.inline >}}
\(\begin{bmatrix}
-1 & 3 \\
3 & 2\end{bmatrix}
=
\begin{bmatrix}
7 \\ 1
\end{bmatrix}\)
{{</ math.inline >}}

<p>

```
\(\begin{bmatrix}
-1 & 3 \\
3 & 2\end{bmatrix}
=
\begin{bmatrix}
7 \\ 1
\end{bmatrix}\)
```

## Equações lineares
{{< math.inline >}}
\(\begin{cases}
-x + 3y = 7
\\
3x + 2y = 1
\end{cases}\)
{{</ math.inline >}}

<p>

```
\(\begin{cases}
-x + 3y = 7
\\
3x + 2y = 1
\end{cases}\)
```

<p>

## Grafo

{{< math.inline >}}
\begin{CD}
A @>a>> B \\
@VbVV @AAcA \\
C @= D
\end{CD}
{{</ math.inline >}}

```
\begin{CD}
A @>a>> B \\
@VbVV @AAcA \\
C @= D
\end{CD}
```


### Referências: [Funções TeX suportadas](https://katex.org/docs/supported.html)
