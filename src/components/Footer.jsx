export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-2.5 px-4 flex-shrink-0">
      <div className="text-center text-xs text-slate-500">
        Powered by{" "}
        <a
          href="https://www.botivate.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 font-medium"
          data-testid="link-botivate"
        >
          Botivate
        </a>
      </div>
    </footer>
  );
}
