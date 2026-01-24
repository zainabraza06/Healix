'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                    <div className="text-center max-w-md">
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">Critical Error</h2>
                        <p className="text-slate-600 mb-8">
                            A critical error occurred in the application layout.
                        </p>
                        <button
                            onClick={() => reset()}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
