import { Plugin, Notice, Modal } from 'obsidian';

interface OutOfSyncInfo {
    cloneFolder: string;
    originalFolder: string;
    hasChanges: boolean;
}

type ConflictResolutionAction = 'sync-to-source' | 'discard-changes' | 'cancel';

class OutOfSyncConfirmModal extends Modal {
    private outOfSyncFolders: OutOfSyncInfo[];
    private callback: (action: ConflictResolutionAction) => void;

    constructor(app: any, outOfSyncFolders: OutOfSyncInfo[], callback: (action: ConflictResolutionAction) => void) {
        super(app);
        this.outOfSyncFolders = outOfSyncFolders;
        this.callback = callback;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        this.createWarningHeader(contentEl);
        this.createFoldersList(contentEl);
        this.createActionPrompt(contentEl);
        this.createActionButtons(contentEl);
    }

    private createWarningHeader(contentEl: HTMLElement) {
        contentEl.createEl('h2', { text: '⚠️ Out-of-Sync Clone Detected' });
        contentEl.createEl('p', { 
            text: 'One or more _ai_temp_unhidden folders contain changes that differ from the original .ai files:' 
        });
    }

    private createFoldersList(contentEl: HTMLElement) {
        const folderList = contentEl.createEl('ul');
        for (const folder of this.outOfSyncFolders) {
            folderList.createEl('li', { text: `${folder.cloneFolder} ↔ ${folder.originalFolder}` });
        }
    }

    private createActionPrompt(contentEl: HTMLElement) {
        contentEl.createEl('p', { text: 'What would you like to do?' });
    }

    private createActionButtons(contentEl: HTMLElement) {
        const buttonContainer = this.createButtonContainer(contentEl);
        
        this.createSyncToSourceButton(buttonContainer);
        this.createDiscardChangesButton(buttonContainer);
        this.createCancelButton(buttonContainer);
    }

    private createButtonContainer(contentEl: HTMLElement): HTMLElement {
        const container = contentEl.createDiv('modal-button-container');
        container.style.display = 'flex';
        container.style.gap = '10px';
        container.style.justifyContent = 'center';
        container.style.marginTop = '20px';
        return container;
    }

    private createSyncToSourceButton(container: HTMLElement) {
        const button = container.createEl('button', { text: 'Sync clone → source (.ai)' });
        button.style.backgroundColor = 'var(--interactive-accent)';
        button.style.color = 'var(--text-on-accent)';
        button.addEventListener('click', () => {
            this.callback('sync-to-source');
            this.close();
        });
    }

    private createDiscardChangesButton(container: HTMLElement) {
        const button = container.createEl('button', { text: 'Discard clone changes' });
        button.addEventListener('click', () => {
            this.callback('discard-changes');
            this.close();
        });
    }

    private createCancelButton(container: HTMLElement) {
        const button = container.createEl('button', { text: 'Cancel' });
        button.addEventListener('click', () => {
            this.callback('cancel');
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export default class AIReadmeUnhidePlugin extends Plugin {
    private static readonly TEMP_FOLDER_SUFFIX = '_temp_unhidden';
    private static readonly AI_FOLDER_PREFIX = '.ai';
    private static readonly MAIN_AI_FOLDER = '.ai';
    private static readonly TEMP_AI_FOLDER = '_ai_temp_unhidden';
    private static readonly README_FILE = 'README.md';
    private static readonly UNKNOWN_FILE_NAME = 'unknown';

    private isUnhiddenMode = false;
    private activeFolders: string[] = [];
    private spoofingStyles: HTMLStyleElement[] = [];
    private outOfSyncFolders: OutOfSyncInfo[] = [];

    async onload() {
        console.log('AI README Unhide Plugin loaded - REFINED STARTUP DETECTION');
        await this.initializePlugin();
        this.registerRibbonToggle();
        console.log('STARTUP: Plugin initialization complete');
    }

    private async initializePlugin() {
        await this.performStartupDetection();
    }

    private registerRibbonToggle() {
        this.addRibbonIcon('eye', 'Toggle AI README visibility', async () => {
            await this.toggleAIReadmeVisibility();
        });
    }

    private async performStartupDetection() {
        console.log('STARTUP DETECTION: Beginning refined detection process...');
        const existingCloneFolders = await this.findExistingCloneFolders();
        console.log(`STARTUP DETECTION: Found ${existingCloneFolders.length} clone folders:`, existingCloneFolders);
        
        if (existingCloneFolders.length === 0) {
            this.initializeCleanState();
            return;
        }

        await this.processExistingClones(existingCloneFolders);
        this.initializeToggleState();
    }

    private async findExistingCloneFolders(): Promise<string[]> {
        const adapter = this.app.vault.adapter;
        const rootContents = await adapter.list('');
        
        return rootContents.folders.filter((folder: string) => 
            folder.endsWith(AIReadmeUnhidePlugin.TEMP_FOLDER_SUFFIX)
        );
    }

    private initializeCleanState() {
        console.log('STARTUP DETECTION: No clones found, starting clean');
    }

    private async processExistingClones(cloneFolders: string[]) {
        const syncChecks = await this.analyzeSyncStatusForAll(cloneFolders);
        const inSyncFolders = syncChecks.filter(result => result && !result.hasChanges);
        const outOfSyncFolders = syncChecks.filter(result => result && result.hasChanges);

        console.log(`STARTUP DETECTION: ${inSyncFolders.length} in-sync, ${outOfSyncFolders.length} out-of-sync`);

        this.preserveOutOfSyncClones(outOfSyncFolders);
        
        if (cloneFolders.length > 0) {
            console.log('STARTUP: Triggering unhide after DOM ready...');
            this.app.workspace.onLayoutReady(() => {
                console.log('DOM READY: Triggering unhideAIReadmes()');
                this.unhideAIReadmes();
            });
        }
    }

    private async analyzeSyncStatusForAll(cloneFolders: string[]): Promise<(OutOfSyncInfo | null)[]> {
        return await Promise.all(
            cloneFolders.map(cloneFolder => this.analyzeFolderSyncStatus(cloneFolder))
        );
    }

    private async cleanupInSyncClones(inSyncFolders: (OutOfSyncInfo | null)[]) {
        const adapter = this.app.vault.adapter;
        
        for (const folder of inSyncFolders) {
            if (folder) {
                console.log(`STARTUP DETECTION: Deleting in-sync clone: ${folder.cloneFolder}`);
                await adapter.rmdir(folder.cloneFolder, true);
            }
        }
    }

    private preserveOutOfSyncClones(outOfSyncFolders: (OutOfSyncInfo | null)[]) {
        this.outOfSyncFolders = outOfSyncFolders.filter(f => f !== null) as OutOfSyncInfo[];
        
        if (this.outOfSyncFolders.length > 0) {
            console.log(`STARTUP DETECTION: ${this.outOfSyncFolders.length} out-of-sync folders preserved`);
            new Notice(`⚠️ Found ${this.outOfSyncFolders.length} out-of-sync clone folder(s). Enable manually to resolve.`);
        }
    }

    private initializeToggleState() {
        this.isUnhiddenMode = false;
        console.log('STARTUP DETECTION: Toggle state initialized to OFF');
    }

    private async analyzeFolderSyncStatus(cloneFolder: string): Promise<OutOfSyncInfo | null> {
        console.log(`SYNC CHECK: Analyzing ${cloneFolder}`);
        const adapter = this.app.vault.adapter;
        const originalFolder = this.deriveOriginalFolderPath(cloneFolder);
        console.log(`SYNC CHECK: Original folder should be ${originalFolder}`);
        
        if (!await this.folderExists(adapter, originalFolder)) {
            console.log(`SYNC CHECK: Original folder ${originalFolder} doesn't exist`);
            return null;
        }

        console.log(`SYNC CHECK: Both folders exist, checking for changes...`);
        const hasChanges = await this.detectSyncChanges(adapter, originalFolder, cloneFolder);
        console.log(`SYNC CHECK: ${cloneFolder} - hasChanges: ${hasChanges}`);
        
        return {
            cloneFolder,
            originalFolder,
            hasChanges
        };
    }

    private deriveOriginalFolderPath(cloneFolder: string): string {
        if (cloneFolder === AIReadmeUnhidePlugin.TEMP_AI_FOLDER) {
            return AIReadmeUnhidePlugin.MAIN_AI_FOLDER;
        }
        return cloneFolder.replace(AIReadmeUnhidePlugin.TEMP_FOLDER_SUFFIX, AIReadmeUnhidePlugin.AI_FOLDER_PREFIX);
    }

    private async folderExists(adapter: any, folderPath: string): Promise<boolean> {
        return await adapter.exists(folderPath);
    }

    private async detectSyncChanges(adapter: any, originalFolder: string, cloneFolder: string): Promise<boolean> {
        const fileCounts = await this.compareFileCounts(adapter, originalFolder, cloneFolder);
        if (fileCounts.differ) {
            return true;
        }

        return await this.compareReadmeContent(adapter, originalFolder, cloneFolder);
    }

    private async compareFileCounts(adapter: any, originalFolder: string, cloneFolder: string) {
        const originalContents = await adapter.list(originalFolder);
        const cloneContents = await adapter.list(cloneFolder);
        
        return {
            differ: originalContents.files.length !== cloneContents.files.length
        };
    }

    private async compareReadmeContent(adapter: any, originalFolder: string, cloneFolder: string): Promise<boolean> {
        const readmeOriginal = `${originalFolder}/${AIReadmeUnhidePlugin.README_FILE}`;
        const readmeClone = `${cloneFolder}/${AIReadmeUnhidePlugin.README_FILE}`;

        if (await adapter.exists(readmeOriginal) && await adapter.exists(readmeClone)) {
            const originalContent = await adapter.read(readmeOriginal);
            const cloneContent = await adapter.read(readmeClone);
            return originalContent !== cloneContent;
        }

        return false;
    }

    async toggleAIReadmeVisibility() {
        if (this.isUnhiddenMode) {
            await this.hideAIReadmes();
        } else {
            await this.unhideAIReadmes();
        }
    }

    private async unhideAIReadmes() {
        console.log('UNHIDE: Starting unhide process...');
        if (this.hasOutOfSyncConflicts()) {
            await this.handleOutOfSyncConflicts();
            return;
        }

        await this.executeStandardUnhideWorkflow();
    }

    private hasOutOfSyncConflicts(): boolean {
        return this.outOfSyncFolders.length > 0;
    }

    private async handleOutOfSyncConflicts(): Promise<void> {
        console.log('UNHIDE: Out-of-sync folders detected, showing confirmation dialog');
        return new Promise<void>((resolve) => {
            const modal = new OutOfSyncConfirmModal(
                this.app, 
                this.outOfSyncFolders,
                async (action) => {
                    await this.processConflictResolution(action);
                    resolve();
                }
            );
            modal.open();
        });
    }

    private async processConflictResolution(action: ConflictResolutionAction) {
        switch (action) {
            case 'sync-to-source':
                await this.syncClonesToSource();
                await this.executeStandardUnhideWorkflow();
                break;
            case 'discard-changes':
                await this.removeOutOfSyncClones();
                await this.executeStandardUnhideWorkflow();
                break;
            case 'cancel':
                new Notice('Operation cancelled - out-of-sync folders preserved');
                break;
        }
    }

    private async syncClonesToSource() {
        const adapter = this.app.vault.adapter;

        for (const folder of this.outOfSyncFolders) {
            try {
                await this.overwriteOriginalWithClone(adapter, folder);
                new Notice(`✅ Synced ${folder.cloneFolder} back to ${folder.originalFolder}`);
            } catch (error) {
                this.logError(`SYNC TO SOURCE for ${folder.cloneFolder}`, error);
                new Notice(`❌ Failed to sync ${folder.cloneFolder}`);
            }
        }

        this.outOfSyncFolders = [];
    }

    private async overwriteOriginalWithClone(adapter: any, folder: OutOfSyncInfo) {
        const cloneContents = await adapter.list(folder.cloneFolder);
        
        for (const file of cloneContents.files) {
            const fileName = this.extractFileName(file);
            const targetPath = `${folder.originalFolder}/${fileName}`;
            const content = await adapter.read(file);
            await adapter.write(targetPath, content);
        }
    }

    private async removeOutOfSyncClones() {
        const adapter = this.app.vault.adapter;

        for (const folder of this.outOfSyncFolders) {
            try {
                await adapter.rmdir(folder.cloneFolder, true);
            } catch (error) {
                this.logError(`DISCARD CHANGES for ${folder.cloneFolder}`, error);
            }
        }

        this.outOfSyncFolders = [];
        new Notice('Out-of-sync changes discarded');
    }

    private async executeStandardUnhideWorkflow() {
        const adapter = this.app.vault.adapter;
        const aiFolders = await this.findAllAIFolders(adapter);
        
        if (aiFolders.length === 0) {
            new Notice('No .ai folders found in vault');
            return;
        }
        
        const processedCount = await this.processAIFolders(adapter, aiFolders);
        this.finalizeUnhideProcess(processedCount);
    }

    private async findAllAIFolders(adapter: any): Promise<string[]> {
        const rootContents = await adapter.list('');
        return rootContents.folders.filter((folder: string) => 
            folder.startsWith(AIReadmeUnhidePlugin.AI_FOLDER_PREFIX) || 
            folder === AIReadmeUnhidePlugin.MAIN_AI_FOLDER
        );
    }

    private async processAIFolders(adapter: any, aiFolders: string[]): Promise<number> {
        let processedCount = 0;
        
        for (const aiFolder of aiFolders) {
            try {
                const cloneFolder = this.deriveCloneFolderPath(aiFolder);
                
                await this.ensureCloneFolderExists(adapter, cloneFolder);
                await this.syncOriginalToClone(aiFolder, cloneFolder);
                await this.applyUIDisplaySpoofing(cloneFolder, aiFolder);
                
                this.activeFolders.push(cloneFolder);
                processedCount++;
            } catch (error) {
                this.logError(`UNHIDE PROCESSING for ${aiFolder}`, error);
            }
        }
        
        return processedCount;
    }

    private deriveCloneFolderPath(aiFolder: string): string {
        return aiFolder === AIReadmeUnhidePlugin.MAIN_AI_FOLDER 
            ? AIReadmeUnhidePlugin.TEMP_AI_FOLDER 
            : aiFolder.replace(AIReadmeUnhidePlugin.AI_FOLDER_PREFIX, AIReadmeUnhidePlugin.TEMP_FOLDER_SUFFIX);
    }

    private async ensureCloneFolderExists(adapter: any, cloneFolder: string) {
        if (!await adapter.exists(cloneFolder)) {
            await adapter.mkdir(cloneFolder);
        }
    }

    private finalizeUnhideProcess(processedCount: number) {
        if (processedCount > 0) {
            this.isUnhiddenMode = true;
            new Notice(`AI files are now visible (${processedCount} folder(s))`);
            this.app.workspace.trigger('file-explorer-refresh');
        }
    }

    private async hideAIReadmes() {
        this.removeSpoofingStyles();
        await this.deleteActiveCloneFolders();
        this.resetHiddenState();
    }

    private removeSpoofingStyles() {
        for (const style of this.spoofingStyles) {
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }
        this.spoofingStyles = [];
    }

    private async deleteActiveCloneFolders() {
        const adapter = this.app.vault.adapter;
        
        for (const folder of this.activeFolders) {
            try {
                if (await adapter.exists(folder)) {
                    await adapter.rmdir(folder, true);
                }
            } catch (error) {
                this.logError(`HIDE CLEANUP for ${folder}`, error);
            }
        }
    }

    private resetHiddenState() {
        this.activeFolders = [];
        this.isUnhiddenMode = false;
        new Notice('AI files are now hidden');
    }

    private async applyUIDisplaySpoofing(cloneFolder: string, originalFolder: string) {
        try {
            const styleId = this.generateSpoofingStyleId(cloneFolder);
            this.removeExistingStyle(styleId);
            
            const style = this.createSpoofingStyle(styleId, cloneFolder, originalFolder);
            this.applySpoofingStyle(style);
        } catch (error) {
            this.logError('UI SPOOFING', error);
        }
    }

    private generateSpoofingStyleId(cloneFolder: string): string {
        return `ai-unhide-spoof-${cloneFolder.replace(/[^a-zA-Z0-9]/g, '-')}`;
    }

    private removeExistingStyle(styleId: string) {
        const existingStyle = document.getElementById(styleId) as HTMLStyleElement;
        if (existingStyle) {
            existingStyle.remove();
        }
    }

    private createSpoofingStyle(styleId: string, cloneFolder: string, originalFolder: string): HTMLStyleElement {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = this.generateSpoofingCSS(cloneFolder, originalFolder);
        return style;
    }

    private generateSpoofingCSS(cloneFolder: string, originalFolder: string): string {
        return `
            .nav-folder-title[data-path="${cloneFolder}"] {
                font-size: 0 !important;
            }
            .nav-folder-title[data-path="${cloneFolder}"]:before {
                content: "${originalFolder}" !important;
                font-size: var(--font-ui-small) !important;
                color: var(--text-normal) !important;
            }
            
            .tree-item[data-path="${cloneFolder}"] .tree-item-inner {
                font-size: 0 !important;
            }
            .tree-item[data-path="${cloneFolder}"] .tree-item-inner:before {
                content: "${originalFolder}" !important;
                font-size: var(--font-ui-small) !important;
                color: var(--text-normal) !important;
            }
        `;
    }

    private applySpoofingStyle(style: HTMLStyleElement) {
        document.head.appendChild(style);
        this.spoofingStyles.push(style);
    }

    private async syncOriginalToClone(originalFolder: string, cloneFolder: string) {
        try {
            const adapter = this.app.vault.adapter;
            const originalContents = await adapter.list(originalFolder);
            
            for (const filePath of originalContents.files) {
                await this.copyFileToClone(adapter, filePath, cloneFolder);
            }
        } catch (error) {
            this.logError(`SYNC ${originalFolder} → ${cloneFolder}`, error);
        }
    }

    private async copyFileToClone(adapter: any, filePath: string, cloneFolder: string) {
        const fileName = this.extractFileName(filePath);
        const cloneFilePath = `${cloneFolder}/${fileName}`;
        const content = await adapter.read(filePath);
        await adapter.write(cloneFilePath, content);
    }

    private extractFileName(filePath: string): string {
        return filePath.split('/').pop() || AIReadmeUnhidePlugin.UNKNOWN_FILE_NAME;
    }

    private logError(context: string, error: any): void {
        console.error(`${context} ERROR:`, error);
    }

    onunload() {
        this.removeSpoofingStyles();
        this.activeFolders = [];
    }
}