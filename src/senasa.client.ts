/**
 * Cliente HTTP del padrón público de SENASA.
 *
 * Endpoints públicos (GET plano, sin auth — el header Bearer va vacío hoy). Es
 * el ÚNICO lugar que conoce las URLs reales de SENASA. No cachea: el caché vive
 * en vademecum (CatalogSyncService); este client solo trae.
 *
 * Caveat: API no oficial, sin SLA. Por eso el consumo siempre pasa por el sync
 * + caché de vademecum, nunca en vivo desde el alta.
 */

import type { SenasaDetail, SenasaListResponse } from './types/senasa-dto.js';

const BASE_URL = 'https://aps2.senasa.gov.ar/adt_api/api';
const LIST_PATH = '/productosFarmacos/search/publicSearchProductoFarmacoDTO';
const DETAIL_PATH = '/productosFarmacos/search/publicSearchProducto';
const DETAIL_PROJECTION = 'productoFarmacoDetallePublicoProjection';
/** Timeout defensivo por request (la fuente puede colgar). */
const REQUEST_TIMEOUT_MS = 20_000;

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`SENASA respondió ${res.status} en ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Tamaño de página para traer el padrón completo en una sola request. */
const FULL_PAGE_SIZE = 10000;

export class SenasaClient {
  /**
   * Trae el padrón completo en una sola request. SENASA devuelve los ~6.9k
   * productos en una página (~3 MB, ~1s); no expone búsqueda por texto, así que
   * el filtrado se hace local (en el CatalogService).
   */
  async fetchAll(): Promise<SenasaListResponse> {
    const url = `${BASE_URL}${LIST_PATH}?page=0&size=${FULL_PAGE_SIZE}`;
    return getJson<SenasaListResponse>(url);
  }

  /**
   * Trae el detalle de un producto por su id numérico de SENASA. El parámetro
   * `producto` es la URI de la entidad (estilo Spring Data REST).
   */
  async fetchDetail(numericId: string): Promise<SenasaDetail> {
    const entityUrl = `${BASE_URL}/productosFarmacos/${encodeURIComponent(numericId)}`;
    const url = `${BASE_URL}${DETAIL_PATH}?producto=${encodeURIComponent(entityUrl)}&projection=${DETAIL_PROJECTION}`;
    return getJson<SenasaDetail>(url);
  }
}
