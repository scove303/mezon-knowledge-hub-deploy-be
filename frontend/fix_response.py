with open('src/app/dashboard/folders/[folderId]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the response handling
old = '''      if (res.success) {
        setShareResult({ share_url: res.data.share_url, share_code: res.data.share_code });
        addToast(t.sharedChats?.shared || "Folder shared successfully!", "success");
      } else {
        addToast(res.message || t.sharedChats?.shareError || "Share failed", "error");
      }'''

new = '''      if (res.share_url) {
        setShareResult({ share_url: res.share_url, share_code: res.share_code });
        addToast(t.sharedChats?.shared || "Folder shared successfully!", "success");
      } else {
        addToast("Share failed", "error");
      }'''

content = content.replace(old, new)

with open('src/app/dashboard/folders/[folderId]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed response handling')