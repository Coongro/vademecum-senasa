# @coongro/vademecum-senasa

## 0.2.0

### Minor Changes

- 599a1c2: Mejoras del mapper SENASA (COONG-224): fallback a `observaciones` cuando `indicacionesYVias` es "NO APLICA" (común en biológicos), sacándole el prefijo administrativo de expediente; y normalización del título de la composición a notación científica con superíndice ("1.58x10e5" → "1.58×10⁵", ">=2.5e8" → "≥2.5×10⁸"). El parseo de cantidad/unidad sigue usando el valor original.

### Patch Changes

- 473fe34: feat: estampar el país (AR) en los productos mapeados (COONG-219)

  El mapper setea `country: "AR"` en summary y detalle, para que al materializar el
  laboratorio en el maestro compartido (`vademecum.laboratories.ensureByName` desde
  el autofill) quede con su país de origen y habilite el gating multi-país. La CUIT
  del laboratorio ya se mapeaba desde `firma.cuit`.
