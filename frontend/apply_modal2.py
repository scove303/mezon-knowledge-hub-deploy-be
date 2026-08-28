with open('src/app/dashboard/folders/[folderId]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Count divs before adding modal
import re
return_start = content.find('return (')
if return_start == -1:
    return_start = content.find('return (')
return_content = content[return_start:]
opens_before = len(re.findall(r'<div', content[return_start:]))
closes_before = len(re.findall(r'</div', content[return_start:]))
print(f'Before modal - Opens: {opens_before}, Closes: {closes_before}')

# Add modal before the closing </div> of outer div
old_end = '''        )}
      </div>
    </div
  );
}'''

new_end = '''        )}
      </div>
    </div>

    {/* Share Result Modal */}
    {shareResult && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md bg-[rgb(var(--color-surface-1))] rounded-xl border border-[rgb(var(--color-border))] p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-[rgb(var(--color-text-primary))]">
              {t.sharedChats?.shared || "Folder Shared!"}
            </h3>
            <button
              onClick={() => setShareResult(null)}
              className="p-1 hover:bg-[rgb(var(--color-surface-2))] rounded-lg text-[rgb(var(--color-text-muted))] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[rgb(var(--color-text-muted))] block mb-1">
                {t.sharedChats?.shareCode || "Share Code"}
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareResult.share_code}
                  className="flex-1 px-3 py-2 rounded-lg bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] font-mono text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareResult.share_code);
                    addToast(t.sharedChats?.copied || "Copied!", "success");
                  }}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                >
                  {t.sharedChats?.copy || "Copy"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-[rgb(var(--color-text-muted))] block mb-1">
                {t.sharedChats?.shareUrl || "Share URL"}
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareResult.share_url}
                  className="flex-1 px-3 py-2 rounded-lg bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] text-sm truncate"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareResult.share_url);
                    addToast(t.sharedChats?.copied || "Copied!", "success");
                  }}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                >
                  {t.sharedChats?.copy || "Copy"}
                </button>
              </div>
            </div>
            <Link
              href={shareResult.share_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors"
            >
              {t.sharedChats?.viewSharedChat || "View Shared Chat"}
            </Link>
          </div>
        </div>
      </div>
    )}

  </div>
  </div>
  </div>
  </div>
  );
}'''

with open('src/app/dashboard/folders/[folderId]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '''        )}
      </div>
    </div
  );
}''',
    new_end)

with open('src/app/dashboard/folders/[folderId]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Applied modal')