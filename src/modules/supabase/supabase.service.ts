import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);

  /** Клиент с service_role — полный доступ (только серверная сторона!) */
  private adminClient: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('supabase.url');
    const serviceRoleKey = this.configService.get<string>('supabase.serviceRoleKey');

    if (!url || !serviceRoleKey) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY не заданы. ' +
          'Supabase Storage/Auth SDK будет недоступен.',
      );
      return;
    }

    this.adminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('✅ Supabase Admin Client инициализирован');
  }

  /**
   * Загрузить файл в Supabase Storage
   */
  async uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ storageKey: string; storageUrl: string }> {
    const { data, error } = await this.adminClient.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      this.logger.error('Storage upload error:', error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    const { data: urlData } = this.adminClient.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      storageKey: data.path,
      storageUrl: urlData.publicUrl,
    };
  }

  /**
   * Удалить файл из Supabase Storage
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.adminClient.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      this.logger.error('Storage delete error:', error.message);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Получить временный signed URL (для приватных bucket)
   */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const { data, error } = await this.adminClient.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data) {
      throw new Error(`Failed to create signed URL: ${error?.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Проверка соединения с Supabase
   */
  async isHealthy(): Promise<boolean> {
    try {
      const { error } = await this.adminClient.from('organizations').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  get admin(): SupabaseClient {
    return this.adminClient;
  }
}
