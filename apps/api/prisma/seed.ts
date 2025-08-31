import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin'
  const passwordHash = await bcrypt.hash(adminPassword, 10)

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
