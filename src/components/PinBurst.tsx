interface PinBurstProps {
  /** 钉子投影到屏幕的位置；拿不到时退回屏幕正中 */
  at?: { x: number; y: number } | null;
}

/** 落钉特写：一枚图钉"啪"地钉进地球仪的那一下 */
export default function PinBurst({ at }: PinBurstProps) {
  return (
    <div
      className="burst"
      style={at ? { left: at.x, top: at.y } : undefined}
      aria-hidden="true"
    >
      <span className="burst__core" />
      <span className="burst__ring" />
      <span className="burst__ring burst__ring--outer" />
      <span className="burst__word">啪！</span>
    </div>
  );
}
