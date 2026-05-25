const Divider = ({ text = 'or' }: { text?: string }) => {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-4 text-xs font-medium uppercase tracking-wider text-slate-400">
          {text}
        </span>
      </div>
    </div>
  );
};

export default Divider;
