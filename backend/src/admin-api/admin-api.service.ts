import { Injectable, Logger, ServiceUnavailableException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AdminApiService {
  private readonly logger = new Logger(AdminApiService.name)

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.getOrThrow<string>('ADMIN_API_URL')
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-clinic-api-key': this.config.getOrThrow<string>('ADMIN_EXTERNAL_API_KEY'),
    }
  }

  // Same SSRF-safe URL builder pattern as clinic-api in pelvi-admin.
  private buildUrl(template: TemplateStringsArray, ...segments: string[]): string {
    let path = template[0]
    for (let i = 0; i < segments.length; i++) {
      path += encodeURIComponent(segments[i]) + template[i + 1]
    }
    const base = new URL(this.baseUrl)
    const url = new URL(base.toString().replace(/\/+$/, '') + path)
    if (url.origin !== base.origin) {
      throw new ServiceUnavailableException('URL inválida para admin API')
    }
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw new ServiceUnavailableException('ADMIN_API_URL deve usar HTTPS em produção')
    }
    return url.toString()
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } catch {
      throw new ServiceUnavailableException('Admin API indisponível')
    } finally {
      clearTimeout(timeout)
    }
  }

  async getSubscription(organizationId: string) {
    this.logger.log(`Fetching subscription for org ${organizationId}`)

    const url = this.buildUrl`/api/clinic-ext/subscription?clinicId=${organizationId}`
    const res = await this.fetchWithTimeout(url, { method: 'GET', headers: this.headers })

    if (res.status === 404) throw new NotFoundException('Assinatura não encontrada')

    if (!res.ok) {
      this.logger.error(`getSubscription failed [${res.status}]`)
      throw new ServiceUnavailableException(`Erro ao buscar assinatura: ${res.status}`)
    }

    return res.json()
  }

  async getPlans() {
    this.logger.log('Fetching available plans')

    const res = await this.fetchWithTimeout(
      this.buildUrl`/api/clinic-ext/plans`,
      { method: 'GET', headers: this.headers },
    )

    if (!res.ok) {
      this.logger.error(`getPlans failed [${res.status}]`)
      throw new ServiceUnavailableException(`Erro ao buscar planos: ${res.status}`)
    }

    return res.json()
  }

  async changePlan(organizationId: string, planId: string) {
    this.logger.log(`Changing plan for org ${organizationId} → ${planId}`)

    const res = await this.fetchWithTimeout(
      this.buildUrl`/api/clinic-ext/subscription/plan`,
      {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({ clinicId: organizationId, planId }),
      },
    )

    if (res.status === 400) {
      const body = await res.json().catch(() => ({}))
      throw new ServiceUnavailableException(body?.message ?? 'Mudança de plano inválida')
    }
    if (res.status === 404) throw new NotFoundException('Plano ou assinatura não encontrados')
    if (!res.ok) {
      this.logger.error(`changePlan failed [${res.status}]`)
      throw new ServiceUnavailableException(`Erro ao mudar plano: ${res.status}`)
    }

    return res.json()
  }

  async cancelSubscription(organizationId: string) {
    this.logger.log(`Canceling subscription for org ${organizationId}`)

    const res = await this.fetchWithTimeout(
      this.buildUrl`/api/clinic-ext/subscription/cancel`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ clinicId: organizationId }),
      },
    )

    if (res.status === 400) {
      const body = await res.json().catch(() => ({}))
      throw new ServiceUnavailableException(body?.message ?? 'Cancelamento inválido')
    }
    if (!res.ok) {
      this.logger.error(`cancelSubscription failed [${res.status}]`)
      throw new ServiceUnavailableException(`Erro ao cancelar assinatura: ${res.status}`)
    }

    return res.json()
  }
}
