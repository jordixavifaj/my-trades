const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTrades() {
  try {
    const tradeCount = await prisma.trade.count();
    const fillCount = await prisma.fill.count();
    
    console.log(`📊 Trades en base de datos: ${tradeCount}`);
    console.log(`📊 Fills en base de datos: ${fillCount}`);
    
    if (tradeCount === 0) {
      console.log('✅ Base de datos completamente vacía');
    } else {
      console.log('⚠️  Aún quedan trades en la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTrades();
