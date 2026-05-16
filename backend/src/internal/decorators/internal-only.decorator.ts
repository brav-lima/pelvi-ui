import { SetMetadata } from '@nestjs/common';

/**
 * Marca uma rota ou controller como exclusiva para uso interno via x-internal-api-key.
 * O JwtAuthGuard respeita esta flag e pula validação JWT — a autenticação real
 * fica a cargo do InternalApiKeyGuard, que DEVE estar presente via @UseGuards.
 *
 * Nunca use @InternalOnly() sem @UseGuards(InternalApiKeyGuard) — sem o guard
 * de API key, a rota ficaria completamente desprotegida.
 */
export const IS_INTERNAL_KEY = 'isInternalRoute';
export const InternalOnly = () => SetMetadata(IS_INTERNAL_KEY, true);
