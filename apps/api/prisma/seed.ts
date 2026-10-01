import { PrismaClient, UserRole } from '@prisma/client'
import { hashPassword } from '../src/auth/password.js'
import { prismaClientOptions } from '../src/prisma/prisma-options.js'

const prisma = new PrismaClient(prismaClientOptions())

async function main() {
  // Тот же алгоритм (scrypt), которым API проверяет пароль при входе; bcrypt-хэш войти не позволял
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin'
  const passwordHash = await hashPassword(adminPassword)

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash, role: UserRole.Admin, emailVerifiedAt: new Date() },
    create: {
      email: 'admin@example.com',
      passwordHash,
      role: UserRole.Admin,
      emailVerifiedAt: new Date(),
    },
  })

  console.log('Seed complete')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
