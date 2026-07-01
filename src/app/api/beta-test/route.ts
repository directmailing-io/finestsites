import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Store data in a JSON file that persists outside the build directory
const DATA_FILE = path.join(process.cwd(), 'beta-test-data.json')

interface TesterData {
  name: string
  items: Record<string, 'ok' | 'issue' | null>
  updatedAt: string
}

function readData(): Record<string, TesterData> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    }
  } catch { /* ignore */ }
  return {}
}

function writeData(data: Record<string, TesterData>) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

export async function GET() {
  const data = readData()
  return NextResponse.json({ testers: Object.values(data) }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, items } = body as { name: string; items: Record<string, 'ok' | 'issue' | null> }
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const data = readData()
  data[name.trim().toLowerCase()] = {
    name: name.trim(),
    items,
    updatedAt: new Date().toISOString(),
  }
  writeData(data)
  return NextResponse.json({ ok: true })
}
