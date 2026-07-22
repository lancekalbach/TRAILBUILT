const CONTOURS: Array<{
  d: string
  elev: string
  labelX: number
  labelY: number
  delay: string
}> = [
  {
    d: 'M-40,820 C80,760 160,700 280,690 C420,740 520,820 680,780 C780,760 860,700 920,660',
    elev: '2340 ft',
    labelX: 300,
    labelY: 718,
    delay: '0s',
  },
  {
    d: 'M-20,740 C100,680 200,640 320,660 C460,690 560,750 720,710 C820,680 900,620 940,580',
    elev: '2480 ft',
    labelX: 340,
    labelY: 652,
    delay: '0.4s',
  },
  {
    d: 'M40,660 C140,600 240,560 360,580 C500,610 600,660 740,620 C840,590 900,540 960,500',
    elev: '2620 ft',
    labelX: 380,
    labelY: 578,
    delay: '0.8s',
  },
  {
    d: 'M120,580 C220,520 320,490 440,510 C560,535 650,580 780,540 C860,515 910,470 980,430',
    elev: '2760 ft',
    labelX: 450,
    labelY: 508,
    delay: '1.2s',
  },
  {
    d: 'M180,500 C280,450 370,430 480,450 C600,475 680,510 800,470 C870,450 920,410 990,370',
    elev: '2900 ft',
    labelX: 490,
    labelY: 445,
    delay: '1.6s',
  },
  {
    d: 'M250,430 C340,390 420,375 520,395 C620,418 700,445 810,410 C870,390 920,355 980,320',
    elev: '3040 ft',
    labelX: 530,
    labelY: 390,
    delay: '2s',
  },
  {
    d: 'M320,370 C400,340 470,330 560,348 C650,368 720,390 820,360 C870,345 910,315 970,280',
    elev: '3180 ft',
    labelX: 570,
    labelY: 342,
    delay: '2.4s',
  },
  {
    d: 'M390,320 C460,298 520,292 600,308 C670,322 730,340 820,318 C860,308 900,285 950,255',
    elev: '3320 ft',
    labelX: 610,
    labelY: 302,
    delay: '2.8s',
  },
  {
    d: 'M-60,920 C40,880 140,860 260,880 C420,910 540,960 700,930 C820,910 900,860 960,820',
    elev: '2200 ft',
    labelX: 260,
    labelY: 878,
    delay: '0.2s',
  },
  {
    d: 'M60,200 C180,240 300,260 420,230 C560,190 680,160 820,190 C900,210 960,250 1020,290',
    elev: '3460 ft',
    labelX: 430,
    labelY: 222,
    delay: '3.2s',
  },
  {
    d: 'M140,140 C260,175 380,185 500,155 C640,115 760,95 880,130 C940,150 990,185 1040,220',
    elev: '3580 ft',
    labelX: 510,
    labelY: 148,
    delay: '3.6s',
  },
  {
    d: 'M220,90 C330,120 440,125 550,100 C680,68 790,55 900,90 C950,105 990,135 1030,165',
    elev: '3700 ft',
    labelX: 560,
    labelY: 94,
    delay: '4s',
  },
]

export function TopoBackground() {
  return (
    <div className="topo-bg" aria-hidden>
      <div className="topo-drift">
        <svg className="topo-svg" viewBox="0 0 900 1100" preserveAspectRatio="xMidYMid slice">
          <defs>
            <filter id="topoSoft" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="0.4" />
            </filter>
          </defs>
          {CONTOURS.map((c) => (
            <g key={c.elev + c.labelX} className="topo-contour" style={{ animationDelay: c.delay }}>
              <path d={c.d} className="topo-line" filter="url(#topoSoft)" />
              <text x={c.labelX} y={c.labelY} className="topo-elev">
                {c.elev}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="topo-vignette" />
      <div className="topo-scan" />
    </div>
  )
}
