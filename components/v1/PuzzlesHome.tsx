/**
 * v1 Puzzles home screen — exact reproduction of the Figma frame
 * "Puzzles home screen" (77:30): black, a greeting + hero heading, and the
 * pill tab bar (Puzzles active / Favorites). Content area is intentionally
 * empty for now — the Continue / Challenges / Popular sections come next.
 *
 * The active tab (Puzzles) sits in a lime-tinted highlight. Its rounded-[15px]
 * is concentric with the pill's rounded-[31px]: 31 − 16 (the pill's vertical
 * padding, i.e. the gap between the two) = 15.
 *
 * The tab bar is rendered in the designed state (Puzzles active). The exported
 * icons carry their own colours (puzzle #9df800, star #5c5c5c); a real
 * active/inactive toggle waits on the Favorites screen being designed.
 */
export default function PuzzlesHome() {
  return (
    <div className="fixed inset-0 bg-black font-outfit">
      {/* header: greeting + hero heading (Figma left 24, top 41) */}
      <div className="absolute top-[41px] left-[24px] flex w-[287px] flex-col gap-[4px]">
        <p className="text-[16px] text-[#959595]">Hey, Neha</p>
        <p className="text-[28px] font-bold tracking-[-0.84px] text-[#eceef2]">
          Are you ready to <span className="text-[#9df800]">play</span>?
        </p>
      </div>

      {/* pill tab bar — a full-width wrapper centres the pill via justify-center.
          (Avoids left-1/2 + translateX(-50%) on a shrink-to-fit box, which
          mis-centres on iOS Safari when the Outfit web-font swaps in late.)
          Sits ~53px from the bottom. */}
      <div className="absolute inset-x-0 bottom-[53px] flex justify-center">
        <div className="flex items-center gap-[24px] overflow-hidden rounded-[31px] bg-[#0d0d0d] px-[24px] py-[16px]">
          {/* Puzzles — active: lime-tinted highlight, rounded-[15px] (concentric with 31) */}
          <button
            type="button"
            className="flex items-center gap-[6px] rounded-[15px] bg-[rgba(151,236,3,0.09)] px-[16px] py-[12px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/v1/icon-puzzle.svg" alt="" width={24} height={24} className="size-[24px]" />
            <span className="text-[16px] font-medium whitespace-nowrap text-[#9df800]">Puzzles</span>
          </button>

          {/* Favorites — inactive: no highlight */}
          <button type="button" className="flex items-center gap-[6px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/v1/icon-star.svg" alt="" width={24} height={24} className="size-[24px]" />
            <span className="text-[16px] whitespace-nowrap text-[#5c5c5c]">Favorites</span>
          </button>
        </div>
      </div>
    </div>
  );
}
