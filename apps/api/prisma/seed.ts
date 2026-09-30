import { PrismaClient, UserRole } from '@prisma/client'
import { hashPassword } from '../src/auth/password'

const prisma = new PrismaClient()

async function main() {
  // Тот же алгоритм (scrypt), которым API проверяет пароль при входе; bcrypt-хэш войти не позволял
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin'
  const passwordHash = await hashPassword(adminPassword)

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash, role: UserRole.Admin },
    create: {
      email: 'admin@example.com',
      passwordHash,
      role: UserRole.Admin,
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
