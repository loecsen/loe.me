import { NextResponse } from 'next/server';
import {
  loadOverrides,
  resolvePlaybooks,
  validatePlaybooks,
} from '../../../lib/domains/resolver';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isDev = process.env.NODE_ENV === 'development';
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;
  const hasAccess = isDev || (adminKey && searchParams.get('key') === adminKey);
  if (!hasAccess) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!isDev) {
    return NextResponse.json({ error: 'not_available' }, { status: 403 });
  }
  const overrides = await loadOverrides();
  const { registry, resolved } = resolvePlaybooks(overrides);
  const validation = validatePlaybooks(resolved);
  return NextResponse.json({ registry, overrides, resolved, validation });
}
