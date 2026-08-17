/**
 * v1 Puzzles home screen — exact reproduction of the Figma frame
 * "Puzzles home screen" (77:30): black, a greeting + hero heading, and the
 * pill tab bar (Puzzles active / Favorites). Content area is intentionally
 * empty for now — the Continue / Challenges / Popular sections come next.
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

      {/* pill tab bar (Figma centred, hugs content, ~29px from the bottom) */}
      <div className="absolute bottom-[29px] left-1/2 flex -translate-x-1/2 items-center justify-center overflow-hidden rounded-[31px] bg-[#0d0d0d] p-[20px]">
        <div className="flex items-center justify-center gap-[36px]">
          <button
            type="button"
            className="flex w-[63px] flex-col items-center justify-center gap-[6px] rounded-[20px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/v1/icon-puzzle.svg" alt="" width={24} height={24} className="size-[24px]" />
            <span className="text-[16px] font-medium whitespace-nowrap text-[#9df800]">Puzzles</span>
          </button>

          <button
            type="button"
            className="flex w-[63px] flex-col items-center justify-center gap-[6px] rounded-[20px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/v1/icon-star.svg" alt="" width={24} height={24} className="size-[24px]" />
            <span className="text-[16px] text-[#5c5c5c]">Favorites</span>
          </button>
        </div>
      </div>
    </div>
  );
}
