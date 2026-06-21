/**
 * Provider AR: implementa el contrato RegulatoryCatalogProvider contra SENASA.
 *
 * Compone el client HTTP + el mapper. No cachea ni decide políticas de sync —
 * eso es responsabilidad del CatalogService de vademecum.
 */

import type {
  CatalogProductDetail,
  CatalogProductSummary,
  RegulatoryCatalogProvider,
} from '@coongro/vademecum';

import {
  mapDetail,
  mapListItem,
  SENASA_SOURCE_ID,
  SENASA_COUNTRY,
} from './mappers/senasa.mapper.js';
import { SenasaClient } from './senasa.client.js';

export class SenasaProvider implements RegulatoryCatalogProvider {
  readonly id = SENASA_SOURCE_ID;
  readonly country = SENASA_COUNTRY;
  readonly label = 'SENASA';

  private readonly client = new SenasaClient();

  async fetchIndex(): Promise<CatalogProductSummary[]> {
    const res = await this.client.fetchAll();
    return (res._embedded?.productosFarmacos ?? []).map(mapListItem);
  }

  async fetchDetail(sourceId: string): Promise<CatalogProductDetail | null> {
    const detail = await this.client.fetchDetail(sourceId);
    // Respuesta sin identidad reconocible = producto inexistente.
    if (!detail || (detail.id === undefined && !detail.numeroInscripcion)) return null;
    return mapDetail(detail, sourceId);
  }
}
