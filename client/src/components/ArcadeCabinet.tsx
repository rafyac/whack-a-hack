export function ArcadeCabinet() {
  return (
    <div className="cabinet-scene" aria-hidden="true">
      <svg className="cabinet-art" viewBox="0 0 170 185" fill="none">
        <ellipse cx="85" cy="174" rx="71" ry="7" fill="#242623" opacity=".15" />
        <path d="M38 10h82l13 17-7 70 20 23-10 54H37l-10-54 20-23-9-70z" fill="#354ba2" stroke="#242623" strokeWidth="3" />
        <path d="M120 10l18 13-4 70 20 25-10 57h-8l10-55-20-23 7-70z" fill="#1e2851" stroke="#242623" strokeWidth="2" />
        <path d="M38 10h82l13 17H39z" fill="#ffb56f" stroke="#242623" strokeWidth="2" />
        <text x="83" y="22" textAnchor="middle" fill="#242623" fontFamily="monospace" fontSize="8" fontWeight="bold">WHACK-A-HACK</text>
        <rect x="47" y="35" width="71" height="59" rx="4" fill="#121a25" stroke="#8487a5" strokeWidth="2" />
        <path d="M61 65h8v-8h7v8h8v-8h7v8h8v8h-8v8h-7v-8H76v8h-7v-8h-8z" fill="#ffc480" />
        <path d="M72 66h4v4h-4zm13 0h4v4h-4z" fill="#121a25" />
        <text x="83" y="48" textAnchor="middle" fill="#9cc1c5" fontFamily="monospace" fontSize="5">MAKE IT COUNT</text>
        <path d="M47 98h79l20 22H27z" fill="#ee785a" stroke="#242623" strokeWidth="2" />
        <ellipse cx="63" cy="112" rx="10" ry="3" fill="#343148" />
        <path d="M63 111V99" stroke="#242623" strokeWidth="3" />
        <circle cx="63" cy="97" r="5" fill="#ffd17d" stroke="#242623" strokeWidth="2" />
        <ellipse cx="102" cy="110" rx="6" ry="3" fill="#ffcb72" stroke="#242623" />
        <ellipse cx="119" cy="113" rx="6" ry="3" fill="#7086d3" stroke="#242623" />
        <path d="M34 131h106M35 137h103M36 143h101" stroke="#ffbd77" strokeWidth="2" />
        <rect x="75" y="150" width="24" height="17" rx="2" fill="#1a213c" />
        <path d="M83 156h9" stroke="#bbc1d7" strokeWidth="2" />
        <path d="M12 33h10m-5-5v10M149 64h10m-5-5v10" stroke="#b43d29" strokeWidth="2" />
      </svg>
      <div className="ticket">ONE TEAM / ONE BALLOT<strong>YOUR<br />POINTS.</strong><span>MAKE THEM COUNT.</span></div>
    </div>
  );
}
