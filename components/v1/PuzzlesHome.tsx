import NavBar from '@/components/v1/NavBar';

/**
 * v1 Puzzles home screen — exact reproduction of the Figma frame
 * "Puzzles home screen" (77:30): black, a greeting + hero heading, and the
 * bottom nav bar. Content area is intentionally empty for now — the Continue /
 * Challenges / Popular sections come next.
 *
 * The nav bar itself (with its Puzzles/Favorites tap toggle) lives in NavBar,
 * a faithful build of the Figma "Nav bar" component (95:117).
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

      <NavBar />
    </div>
  );
}
