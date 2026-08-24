"use client"

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { FileIcon, FolderIcon, FolderOpenIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

type TreeViewElement = {
  id: string
  name: string
  isSelectable?: boolean
  children?: TreeViewElement[]
}

type TreeContextProps = {
  selectedId: string | undefined
  expandedItems: string[] | undefined
  indicator: boolean
  handleExpand: (id: string) => void
  selectItem: (id: string) => void
  setExpandedItems?: React.Dispatch<React.SetStateAction<string[] | undefined>>
  openIcon?: React.ReactNode
  closeIcon?: React.ReactNode
  direction: "rtl" | "ltr"
}

const TreeContext = createContext<TreeContextProps | null>(null)

const useTree = () => {
  const context = useContext(TreeContext)
  if (!context) {
    throw new Error("useTree must be used within a TreeProvider")
  }
  return context
}

interface TreeViewComponentProps extends React.HTMLAttributes<HTMLDivElement> {}

type Direction = "rtl" | "ltr" | undefined

type TreeViewProps = {
  initialSelectedId?: string
  indicator?: boolean
  elements?: TreeViewElement[]
  initialExpandedItems?: string[]
  expandedItems?: string[]
  onExpandedChange?: (items: string[]) => void
  openIcon?: React.ReactNode
  closeIcon?: React.ReactNode
} & TreeViewComponentProps

const Tree = forwardRef<HTMLDivElement, TreeViewProps>(
  (
    {
      className,
      elements,
      initialSelectedId,
      initialExpandedItems,
      expandedItems: propExpandedItems,
      onExpandedChange,
      children,
      indicator = true,
      openIcon,
      closeIcon,
      dir,
      ...props
    },
    ref,
  ) => {
    const [selectedId, setSelectedId] = useState<string | undefined>(
      initialSelectedId,
    )
    const [uncontrolledExpandedItems, setUncontrolledExpandedItems] = useState<string[] | undefined>(
      initialExpandedItems,
    )

    const isControlled = propExpandedItems !== undefined
    const expandedItems = isControlled ? propExpandedItems : uncontrolledExpandedItems

    const selectItem = useCallback((id: string) => {
      setSelectedId(id)
    }, [])

    const setExpandedItems = useCallback(
      (
        updater:
          | React.SetStateAction<string[] | undefined>
          | ((prev: string[] | undefined) => string[] | undefined),
      ) => {
        const nextValue =
          typeof updater === "function" ? updater(expandedItems) : updater
        if (!isControlled) {
          setUncontrolledExpandedItems(nextValue)
        }
        onExpandedChange?.(nextValue ?? [])
      },
      [isControlled, expandedItems, onExpandedChange],
    )

    const handleExpand = useCallback(
      (id: string) => {
        setExpandedItems((prev) => {
          if (prev?.includes(id)) {
            return prev.filter((item) => item !== id)
          }
          return [...(prev ?? []), id]
        })
      },
      [setExpandedItems],
    )

    const expandSpecificTargetedElements = useCallback(
      (elements?: TreeViewElement[], selectId?: string) => {
        if (!elements || !selectId) return
        const findParent = (
          currentElement: TreeViewElement,
          currentPath: string[] = [],
        ) => {
          const isSelectable = currentElement.isSelectable ?? true
          const newPath = [...currentPath, currentElement.id]
          if (currentElement.id === selectId) {
            if (isSelectable) {
              setExpandedItems((prev) => [...(prev ?? []), ...newPath])
            } else {
              if (newPath.includes(currentElement.id)) {
                newPath.pop()
                setExpandedItems((prev) => [...(prev ?? []), ...newPath])
              }
            }
            return
          }
          if (
            isSelectable &&
            currentElement.children &&
            currentElement.children.length > 0
          ) {
            currentElement.children.forEach((child) => {
              findParent(child, newPath)
            })
          }
        }
        elements.forEach((element) => {
          findParent(element)
        })
      },
      [setExpandedItems],
    )

    useEffect(() => {
      if (initialSelectedId) {
        expandSpecificTargetedElements(elements, initialSelectedId)
      }
    }, [initialSelectedId, elements, expandSpecificTargetedElements])

    const direction = dir === "rtl" ? "rtl" : "ltr"

    return (
      <TreeContext.Provider
        value={{
          selectedId,
          expandedItems,
          handleExpand,
          selectItem,
          setExpandedItems,
          indicator,
          openIcon,
          closeIcon,
          direction,
        }}
      >
        <div className={cn("size-full", className)}>
          <ScrollArea
            ref={ref}
            className="h-full relative px-2"
            dir={dir as Direction}
          >
            <AccordionPrimitive.Root
              {...props}
              type="multiple"
              defaultValue={expandedItems}
              value={expandedItems}
              className="flex flex-col gap-1"
              onValueChange={(value) => {
                if (!isControlled) {
                  setUncontrolledExpandedItems(value)
                }
                onExpandedChange?.(value)
              }}
              dir={dir as Direction}
            >
              {children}
            </AccordionPrimitive.Root>
          </ScrollArea>
        </div>
      </TreeContext.Provider>
    )
  },
)

Tree.displayName = "Tree"

const TreeIndicator = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { direction } = useTree()

  return (
    <div
      dir={direction}
      ref={ref}
      className={cn(
        "h-full w-px bg-[rgb(var(--color-border))] absolute left-1.5 rtl:right-1.5 py-3 rounded-md duration-300 ease-in-out",
        className,
      )}
      {...props}
    />
  )
})

TreeIndicator.displayName = "TreeIndicator"

interface FolderComponentProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> {}

type FolderProps = {
  expandedItems?: string[]
  element: string
  isSelectable?: boolean
  isSelect?: boolean
  onSelect?: (id: string) => void
  actions?: React.ReactNode
  badge?: React.ReactNode
  openIcon?: React.ReactNode
  closeIcon?: React.ReactNode
} & FolderComponentProps

const Folder = forwardRef<
  HTMLDivElement,
  FolderProps & React.HTMLAttributes<HTMLDivElement>
>(
  (
    {
      className,
      element,
      value,
      isSelectable = true,
      isSelect,
      onSelect,
      actions,
      badge,
      openIcon,
      closeIcon,
      expandedItems,
      children,
      ...props
    },
    ref,
  ) => {
    const {
      direction,
      handleExpand,
      indicator,
      setExpandedItems,
      openIcon: contextOpenIcon,
      closeIcon: contextCloseIcon,
    } = useTree()

    return (
      <AccordionPrimitive.Item
        {...props}
        ref={ref}
        value={value}
        className="relative h-full group/folder hover:z-[60]"
      >
        <div className="relative">
          <AccordionPrimitive.Trigger
            className={cn(
              `flex items-center gap-1.5 text-sm rounded-md w-full min-w-0 text-left pr-8`,
              className,
              {
                "bg-[rgb(var(--color-primary)/0.12)] text-[rgb(var(--color-primary))] border border-[rgb(var(--color-primary)/0.3)] font-medium": isSelect && isSelectable,
                "cursor-pointer": isSelectable,
                "cursor-not-allowed opacity-50": !isSelectable,
              },
            )}
            disabled={!isSelectable}
            onClick={() => {
              handleExpand(value)
              onSelect?.(value)
            }}
          >
            {expandedItems?.includes(value)
              ? openIcon ?? contextOpenIcon ?? <FolderOpenIcon className="size-4 shrink-0" />
              : closeIcon ?? contextCloseIcon ?? <FolderIcon className="size-4 shrink-0" />}
            <span className="min-w-0 truncate">{element}</span>
          </AccordionPrimitive.Trigger>
          {badge && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] opacity-60 group-hover/folder:hidden">
              {badge}
            </span>
          )}
          {actions && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity">
              {actions}
            </div>
          )}
        </div>
        <AccordionPrimitive.Content className="text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down relative overflow-hidden h-full acc-content">
          {element && indicator && <TreeIndicator aria-hidden="true" />}
          <AccordionPrimitive.Root
            dir={direction}
            type="multiple"
            className="flex flex-col gap-1 py-1 ml-5 rtl:mr-5"
            defaultValue={expandedItems}
          >
            {children}
          </AccordionPrimitive.Root>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    )
  },
)

Folder.displayName = "Folder"

const File = forwardRef<
  HTMLButtonElement,
  {
    value: string
    handleSelect?: (id: string) => void
    isSelectable?: boolean
    isSelect?: boolean
    fileIcon?: React.ReactNode
    actions?: React.ReactNode
    badge?: React.ReactNode
    preview?: React.ReactNode
  } & React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(
  (
    {
      value,
      className,
      handleSelect,
      isSelectable = true,
      isSelect,
      fileIcon,
      actions,
      badge,
      preview,
      children,
      ...props
    },
    ref,
  ) => {
    const { direction, selectedId, selectItem } = useTree()
    const isSelected = isSelect ?? selectedId === value
    // Preview mở lên trên nếu row nằm sát đáy vùng cuộn (không bị lọt ra ngoài)
    const [previewUp, setPreviewUp] = useState(false)
    const rowRef = useRef<HTMLDivElement>(null)
    const handleMouseEnter = () => {
      const row = rowRef.current
      if (!row) return
      const vp = row.closest("[data-radix-scroll-area-viewport]")
      const rowRect = row.getBoundingClientRect()
      const limit = vp ? vp.getBoundingClientRect().bottom : window.innerHeight
      setPreviewUp(rowRect.bottom + 240 > limit)
    }
    return (
      <AccordionPrimitive.Item
        ref={rowRef}
        value={value}
        className="relative group/file hover:z-[60]"
        onMouseEnter={handleMouseEnter}
      >
        <div className="relative">
          <AccordionPrimitive.Trigger
            ref={ref}
            {...props}
            dir={direction}
            disabled={!isSelectable}
            className={cn(
              "flex items-center gap-1.5 cursor-pointer text-sm pr-1 rtl:pl-1 rtl:pr-0 rounded-md duration-200 ease-in-out w-full min-w-0 text-left pr-8",
              {
                "bg-[rgb(var(--color-primary)/0.15)] text-[rgb(var(--color-primary))] font-semibold": isSelected && isSelectable,
              },
              isSelectable
                ? "cursor-pointer text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))]"
                : "opacity-50 cursor-not-allowed",
              className,
            )}
            onClick={() => {
              selectItem(value)
              handleSelect?.(value)
            }}
          >
            {fileIcon ?? <FileIcon className="size-4 shrink-0" />}
            {children}
          </AccordionPrimitive.Trigger>
          {badge && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] opacity-60 group-hover/file:hidden">
              {badge}
            </span>
          )}
          {actions && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity">
              {actions}
            </div>
          )}
          {preview && (
            <div
              className={cn(
                "absolute left-0 right-0 z-50 hidden group-hover/file:block pointer-events-none",
                previewUp ? "bottom-full mb-1" : "top-full mt-0.5",
              )}
            >
              {preview}
            </div>
          )}
        </div>
      </AccordionPrimitive.Item>
    )
  },
)

File.displayName = "File"

const CollapseButton = forwardRef<
  HTMLButtonElement,
  {
    elements: TreeViewElement[]
    expandAll?: boolean
  } & React.HTMLAttributes<HTMLButtonElement>
>(({ className, elements, expandAll = false, children, ...props }, ref) => {
  const { expandedItems, setExpandedItems } = useTree()

  const expendAllTree = useCallback((elements: TreeViewElement[]) => {
    const expandTree = (element: TreeViewElement) => {
      const isSelectable = element.isSelectable ?? true
      if (isSelectable && element.children && element.children.length > 0) {
        setExpandedItems?.((prev) => [...(prev ?? []), element.id])
        element.children.forEach(expandTree)
      }
    }

    elements.forEach(expandTree)
  }, [setExpandedItems])

  const closeAll = useCallback(() => {
    setExpandedItems?.([])
  }, [setExpandedItems])

  useEffect(() => {
    if (expandAll) {
      expendAllTree(elements)
    }
  }, [expandAll, elements, expendAllTree])

  return (
    <Button
      variant={"ghost"}
      className={cn("h-8 w-fit p-1", className)}
      onClick={
        expandedItems && expandedItems.length > 0
          ? closeAll
          : () => expendAllTree(elements)
      }
      ref={ref}
      {...props}
    >
      {children}
      <span className="sr-only">Toggle</span>
    </Button>
  )
})

CollapseButton.displayName = "CollapseButton"

export { CollapseButton, File, Folder, Tree, type TreeViewElement }
