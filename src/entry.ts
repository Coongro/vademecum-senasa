/**
 * @coongro/vademecum-senasa — Plugin lifecycle entry point
 *
 * Registra el provider SENASA en el ProviderRegistry de vademecum al activarse,
 * y lo quita al desactivarse. El registry es un singleton compartido por proceso
 * (ver doc en @coongro/vademecum); importarlo como dependencia garantiza la
 * misma instancia que el resto del código que lo consume.
 */

import type { ModuleActivationContext } from '@coongro/plugin-sdk';
import { providerRegistry } from '@coongro/vademecum/server';

import { SenasaProvider } from './senasa.provider.js';

const provider = new SenasaProvider();

export function activate(context: ModuleActivationContext): void {
  providerRegistry.register(provider);
  context.api.logger.info(
    `vademecum-senasa: provider "${provider.id}" (${provider.country}) registrado`
  );
}

export function deactivate(): void {
  providerRegistry.unregister(provider.id);
}
