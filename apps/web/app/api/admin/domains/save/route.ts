import { NextResponse } from 'next/server';
import {
  loadOverrides,
  resolvePlaybooks,
  saveOverrides,
  validatePlaybooks,
} from '../../../../lib/domains/resolver';
import type { DomainOverrides } from '../../../../lib/domains/resolver';

export async function POST(request: Request) {
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

  const body = (await request.json()) as DomainOverrides;
  const overrides = { playbooks: body?.playbooks ?? [] };
  const { resolved } = resolvePlaybooks(overrides);
  const validation = validatePlaybooks(resolved);
  if (!validation.ok) {
    return NextResponse.json({ error: 'invalid_overrides', validation }, { status: 400 });
  }
  await saveOverrides(overrides);
  const currentOverrides = await loadOverrides();
  const current = resolvePlaybooks(currentOverrides);
  return NextResponse.json({
    overrides: currentOverrides,
    resolved: current.resolved,
    validation: validatePlaybooks(current.resolved),
  });
}
