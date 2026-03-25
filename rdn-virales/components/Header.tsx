"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#000000] py-3">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center justify-center gap-2">
          <Link href="/" className="inline-flex shrink-0">
            <img
              src="https://www.rdn.com.py/wp-content/uploads/2020/02/cropped-logo-invertido@2x.png"
              alt="RDN Virales"
              className="h-[50px] w-auto"
            />
          </Link>
          <span className="inline-flex items-center rounded border border-[#e00000] px-2 py-0.5 text-base font-bold leading-none text-[#e00000]">
            VIRALES
          </span>
        </div>
        <p className="text-center text-sm text-gray-300">
          Toda la información en un instante
        </p>
      </div>
    </header>
  );
}
