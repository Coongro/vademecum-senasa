/**
 * Repository de catálogo expuesto al frontend bajo el prefix `vademecum.catalog`.
 *
 * El auto-wiring del core registra cada método público como acción
 * (`vademecum.catalog.search`, `vademecum.catalog.getDetail`). Instalar este
 * plugin provider = "registrar" esas acciones en el tenant; si el provider no
 * está instalado (otro país), las acciones no existen y el consumidor (alta de
 * medicamento) cae a modo manual. Eso ES el gating por país.
 *
 * Compone la maquinaria reutilizable de vademecum (CatalogService) con el
 * provider concreto de SENASA.
 */

import type {
  CatalogProductDetail,
  CatalogProductKind,
  CatalogProductSummary,
} from '@coongro/vademecum';
import { CatalogService } from '@coongro/vademecum/server';

import { SenasaProvider } from '../senasa.provider.js';

export class CatalogRepository {
  private readonly service: CatalogService;

  // El auto-wiring pasa el ModuleDatabaseAPI al constructor, pero el catálogo
  // se cachea en memoria (no DB), así que no se usa.
  constructor() {
    this.service = new CatalogService(new SenasaProvider());
  }

  /** Busca en el índice cacheado del padrón (lazy-sync por TTL). */
  async search(params: {
    query: string;
    limit?: number;
    kind?: CatalogProductKind;
  }): Promise<CatalogProductSummary[]> {
    return this.service.search(params);
  }

  /** Trae la ficha completa (caché o fuente por demanda). */
  async getDetail(params: { sourceId: string }): Promise<CatalogProductDetail | null> {
    return this.service.getDetail(params);
  }
}
