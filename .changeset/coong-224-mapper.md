---
"@coongro/vademecum-senasa": minor
---

Mejoras del mapper SENASA (COONG-224): fallback a `observaciones` cuando `indicacionesYVias` es "NO APLICA" (común en biológicos), sacándole el prefijo administrativo de expediente; y normalización del título de la composición a notación científica con superíndice ("1.58x10e5" → "1.58×10⁵", ">=2.5e8" → "≥2.5×10⁸"). El parseo de cantidad/unidad sigue usando el valor original.
