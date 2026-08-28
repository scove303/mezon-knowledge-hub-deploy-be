with open('src/app/dashboard/folders/[folderId]/page.tsx', 'rb') as f:
    content = f.read()

# Fix the duplicate ternary at line 602
old = b'isDocumentSideOpen\r\n            ? "flex-1 opacity-100"\r\n            ? "flex-1 opacity-100"\r\n            : "w-0 opacity-0 overflow-hidden"'
new = b'isDocumentSideOpen\r\n            ? "flex-1 opacity-100"\r\n            : "w-0 opacity-0 overflow-hidden"'

content = content.replace(old, new)

with open('src/app/dashboard/folders/[folderId]/page.tsx', 'wb') as f:
    f.write(content)
print('Fixed duplicate ternary')