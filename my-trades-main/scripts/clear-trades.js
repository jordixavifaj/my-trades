const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearAllTrades() {
  try {
    console.log('🗑️  Eliminando todos los trades...');
    
    // Eliminar todos los fills primero (por la relación foreign key)
    const deletedFills = await prisma.fill.deleteMany({});
    console.log(`✅ Eliminados ${deletedFills.count} fills`);
    
    // Eliminar todos los trades
    const deletedTrades = await prisma.trade.deleteMany({});
    console.log(`✅ Eliminados ${deletedTrades.count} trades`);
    
    // Eliminar logs de auditoría relacionados
    const deletedAuditLogs = await prisma.auditLog.deleteMany({});
    console.log(`✅ Eliminados ${deletedAuditLogs.count} logs de auditoría`);
    
    console.log('🎉 Base de datos limpiada exitosamente');
    
  } catch (error) {
    console.error('❌ Error al limpiar la base de datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllTrades();
