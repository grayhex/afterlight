import { PrismaClient } from '@prisma/client'
import { Logger } from '@nestjs/common'

const prisma = new PrismaClient()

async function main() {
  await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tier: 'Free',
      limits: { maxVaults: 1, maxBlocksPerVault: 50, maxVerifiers: 5 }
    }
  })

  await prisma.setting.upsert({
    where: { key: 'policy.defaults' },
    update: {},
    create: {
      key: 'policy.defaults',
      value: {
        quorumThreshold: 3,
        maxVerifiers: 5,
        heartbeatTimeoutDays: 60,
        graceHours: 24,
        verifierMayBeRecipient: false
      }
    }
  })

  await prisma.siteContent.upsert({
    where: { key_locale: { key: 'landing.hero', locale: 'ru' } },
    update: {},
    create: { key: 'landing.hero', locale: 'ru', data: { title: 'Безопасный сейф для близких', subtitle: 'Откройте только нужное и только когда нужно' } }
  })

  const templates = [
    { key: 'invite_verifier', subject: 'Вас назначили верификатором', body: 'Здравствуйте! Вас пригласили как верификатора…' },
    { key: 'verification_progress', subject: 'Ход подтверждения события', body: 'Статус: {confirms}/{quorum}…' },
    { key: 'grace_notice', subject: 'Grace‑период перед раскрытием', body: 'Раскрытие запланировано через {hours} часов…' }
  ]
  for (const t of templates) {
    await prisma.emailTemplate.upsert({
      where: { key_locale: { key: t.key, locale: 'ru' } },
      update: {},
      create: { key: t.key, locale: 'ru', subject: t.subject, body: t.body }
    })
  }

  Logger.log('Seed complete')
}

main().catch(e => {
  Logger.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
