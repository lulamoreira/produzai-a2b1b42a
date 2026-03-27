interface AquaIconProps {
  icon: React.ElementType;
  size?: "sm" | "md" | "lg" | "xl";
  color?: string;
  className?: string;
}

const SIZES = {
  sm: { container: "w-8 h-8", icon: "w-4 h-4", radius: "rounded-[8px]" },
  md: { container: "w-10 h-10", icon: "w-5 h-5", radius: "rounded-[10px]" },
  lg: { container: "w-12 h-12", icon: "w-6 h-6", radius: "rounded-[12px]" },
  xl: { container: "w-14 h-14", icon: "w-7 h-7", radius: "rounded-[14px]" },
};

const AquaIcon = ({ icon: Icon, size = "md", color, className = "" }: AquaIconProps) => {
  const s = SIZES[size];

  return (
    <div
      className={`${s.container} ${s.radius} relative flex items-center justify-center overflow-hidden shadow-lg ${className}`}
      style={{
        background: color
          ? `linear-gradient(145deg, ${color}, ${color}dd)`
          : undefined,
      }}
    >
      {/* Aqua shine overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(175deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 45%, rgba(0,0,0,0.05) 55%, rgba(0,0,0,0.08) 100%)",
        }}
      />
      {/* Inner highlight */}
      <div
        className="absolute top-[1px] left-[2px] right-[2px] pointer-events-none"
        style={{
          height: "45%",
          borderRadius: "inherit",
          background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
      <Icon className={`${s.icon} text-white relative z-10 drop-shadow-sm`} strokeWidth={2} />
    </div>
  );
};

export default AquaIcon;
