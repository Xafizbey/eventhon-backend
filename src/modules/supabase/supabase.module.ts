import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

/**
 * Глобальный модуль — SupabaseService доступен во всех модулях
 * без явного импорта
 */
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
