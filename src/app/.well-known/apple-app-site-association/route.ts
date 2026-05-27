import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const aasa = {
  applinks: {
    apps: [],
    details: [
      {
        appID: 'U7CT3BQ7HY.de.dealbuddy.app',
        paths: [
          '/c/*',
          '/deal/*',
          '/join/*',
          '/invite/*',
          '/profile/*',
          '/groups/*',
          '/g/*',
        ],
      },
    ],
  },
  webcredentials: {
    apps: ['U7CT3BQ7HY.de.dealbuddy.app'],
  },
};

export function GET() {
  return NextResponse.json(aasa, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
