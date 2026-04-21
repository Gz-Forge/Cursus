// TablaApp/src/services/syncService.ts
import { supabase } from './supabase';
import { AppState } from '../types';

export interface PerfilRemoto {
  perfil_id: string;
  nombre: string;
  updated_at: string;
  datos: AppState;
}

/** Sube uno o varios perfiles al servidor */
export async function subirPerfiles(
  userId: string,
  perfiles: Array<{ perfil_id: string; nombre: string; datos: AppState }>
): Promise<string | null> {
  const rows = perfiles.map(p => ({
    user_id: userId,
    perfil_id: p.perfil_id,
    nombre: p.nombre,
    datos: p.datos,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('perfiles_sync')
    .upsert(rows, { onConflict: 'user_id,perfil_id' });

  return error ? error.message : null;
}

/** Lista los perfiles disponibles en la nube */
export async function listarPerfilesRemotos(userId: string): Promise<PerfilRemoto[]> {
  const { data, error } = await supabase
    .from('perfiles_sync')
    .select('perfil_id, nombre, updated_at, datos')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PerfilRemoto[];
}

/** Descarga un perfil específico de la nube */
export async function bajarPerfil(
  userId: string,
  perfilId: string
): Promise<PerfilRemoto | null> {
  const { data, error } = await supabase
    .from('perfiles_sync')
    .select('perfil_id, nombre, updated_at, datos')
    .eq('user_id', userId)
    .eq('perfil_id', perfilId)
    .single();

  if (error) return null;
  return data as PerfilRemoto;
}
