+++
date = '2025-06-08T22:37:23-03:00'
title = 'Using KaTeX'
tags = ["ml", "math"]
math = true
+++

Using [KaTeX](https://katex.org/) for matrix and math representation.

## Matrix:

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

## Linear Equations
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

## Graph

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


### References: [Supported TeX Functions](https://katex.org/docs/supported.html)
