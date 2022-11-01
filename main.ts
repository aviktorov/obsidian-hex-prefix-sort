import { FileExplorerView, Plugin, TAbstractFile, TFile, TFolder, Vault } from 'obsidian';
import { around } from 'monkey-around';

// Needed to support monkey-patching of the folder sort() function
declare module 'obsidian' {
	export interface ViewRegistry {
		viewByType: Record<string, (leaf: WorkspaceLeaf) => unknown>;
	}

	export interface App {
		viewRegistry: ViewRegistry;
	}

	interface FileExplorerFolder {
	}

	export interface FileExplorerView extends View {
		createFolderDom(folder: TFolder): FileExplorerFolder;

		requestSort(): void;
	}
}

type MonkeyAroundUninstaller = () => void


export const hexPrefixSort = function(order: string[]) {
	let fileExplorer = this.fileExplorer;
	const elements: Array<TAbstractFile> = this.file.children.map((entry: TAbstractFile) => entry);

	elements.sort(function (file0: TAbstractFile, file1: TAbstractFile) {
		return file0.path.localeCompare(file1.path);
	});

	const items = elements.map((element: TAbstractFile) => fileExplorer.fileItems[element.path]);
	this.vChildren.setChildren(items);
};

export default class HexPrefixSortPlugin extends Plugin {

	async onload() {
		console.log("loading hex-prefix-sort");

		this.app.workspace.onLayoutReady(() => {
			const fileExplorer: FileExplorerView | undefined = this.getFileExplorer();
			if (!fileExplorer)
				return;

			if (this.patchFileExplorerFolder(fileExplorer))
				fileExplorer.requestSort();
		})
	}

	patchFileExplorerFolder(fileExplorer?: FileExplorerView): boolean {
		fileExplorer = fileExplorer ?? this.getFileExplorer()
		if (!fileExplorer)
			return false;

		// @ts-ignore
		let tmpFolder = new TFolder(Vault, "");
		let Folder = fileExplorer.createFolderDom(tmpFolder).constructor;
		const uninstallerOfFolderSortFunctionWrapper: MonkeyAroundUninstaller = around(Folder.prototype, {
			sort(old: any) {
				return function (...args: any[]) {
					return hexPrefixSort.call(this, ...args);
					// return old.call(this, ...args);
				};
			}
		})
		this.register(uninstallerOfFolderSortFunctionWrapper);

		return true;
	}

	getFileExplorer(): FileExplorerView | undefined {
		let fileExplorer: FileExplorerView | undefined = this.app.workspace.getLeavesOfType("file-explorer")?.first()
			?.view as unknown as FileExplorerView;
		return fileExplorer;
	}

	onunload() {

	}
}
