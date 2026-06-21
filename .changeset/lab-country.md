---
"@coongro/vademecum-senasa": patch
---

feat: estampar el país (AR) en los productos mapeados (COONG-219)

El mapper setea `country: "AR"` en summary y detalle, para que al materializar el
laboratorio en el maestro compartido (`vademecum.laboratories.ensureByName` desde
el autofill) quede con su país de origen y habilite el gating multi-país. La CUIT
del laboratorio ya se mapeaba desde `firma.cuit`.
