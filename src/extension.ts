'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // This code will only be executed once when your extension is activated

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // console.log('Congratulations, your extension "vscode-position" is now active!');

    var controller = new PositionController();
    context.subscriptions.push(controller);
    context.subscriptions.push(vscode.commands.registerCommand('position.goto', () => controller.goToPositionCommand()));
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function getOptionalNumber(numberAsString ?: string): [number | undefined, boolean] {
    let optionalNumber: number | undefined = undefined;
    let isRelative: boolean = false;

    let num: number = Number(numberAsString);
    if (!isNaN(num) && numberAsString && numberAsString.length) {
        optionalNumber = num;
        isRelative = ['+', '-'].includes(numberAsString!.charAt(0));
    }
    return [optionalNumber, isRelative];
}

class PositionController {
    private disposable: vscode.Disposable;
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'position.goto';
        this.statusBarItem.tooltip = "Go to Position";

        // subscribe to selection change and editor activation events
        let subscriptions: vscode.Disposable[] = [];
        vscode.window.onDidChangeTextEditorSelection(this.onEvent, this, subscriptions);
        vscode.window.onDidChangeActiveTextEditor(this.onEvent, this, subscriptions);

        // create a combined disposable from both event subscriptions
        this.disposable = vscode.Disposable.from(...subscriptions);
        this.updatePosition();
    }

    public goToPositionCommand(): void {
         // declaring manager? as optional makes .then/async blocks 'forget' the
         // definite assignment/null check inference done after create() in tslint.
        let manager: CursorManager;
        manager = CursorManager.create()!;
        if (!manager) { return; }

        vscode.window.showInputBox({
            prompt: `Type an offset number from 0 to ${manager.maxPosition}.`,
            value: String(manager.cursorOffset),
            validateInput: (input: string) => {
                manager.previewCursorOffset(input);
                return undefined;
            }
        }).then((input?: string) => {
            input !== undefined ? manager.commit() : manager.abort();
        });
    }

    private updatePosition(): void {
        let manager = CursorManager.create();
        if (!manager) {
            this.statusBarItem.hide();
            return;
        }

        let offset = manager.cursorOffset;

        if (offset !== undefined) {
            // Update the status bar
            this.statusBarItem.text = `Pos ${offset}`;
            this.statusBarItem.show();
        }
    }

    private onEvent(): void {
        this.updatePosition();
    }

    public dispose() {
        this.disposable.dispose();
        this.statusBarItem.dispose();
    }
}

class CursorManager {
    private static cursorPositionDecoration = vscode.window.createTextEditorDecorationType({
        borderColor: new vscode.ThemeColor('editor.foreground'),
        borderStyle: 'solid',
        borderWidth: '1px',
        outlineColor: new vscode.ThemeColor('editor.foreground'),
        outlineStyle: 'solid',
        outlineWidth: '1px',
    });
    // Originally preview was implemented without actually moving the cursor, but that was weird when
    // the real cursor highlight and the mimicked one were both visible.  Leaving this in just because.
    // private static CursorLineDecoration = vscode.window.createTextEditorDecorationType({
    //     backgroundColor: new vscode.ThemeColor('editor.lineHighlightBackground'),
    //     borderColor: new vscode.ThemeColor('editor.lineHighlightBorder'),
    //     borderStyle: 'solid',
    //     borderWidth: '1px',
    //     isWholeLine: true,
    // });

    public static create()
    {
        let editor = vscode.window.activeTextEditor;
        let doc = editor ? editor.document : undefined;
        if (!doc) { return undefined; }

        return new CursorManager(editor!, doc);
    }

    private readonly originalCursorOffset: number;
    private readonly cachedSelections: vscode.Selection[];

    constructor(readonly editor: vscode.TextEditor, readonly document: vscode.TextDocument) {
        this.originalCursorOffset = document.offsetAt(editor.selection.active);
        this.cachedSelections = [editor.selection]; // dup active selection for our working copy
        this.cachedSelections.push(...editor.selections);
    }

    public get cursor() : vscode.Position {
        return this.editor.selection.active;
    }
    public get cursorOffset() : number {
         return this.document.offsetAt(this.cursor);
    }
    // public get selections() : vscode.Selection[] {
    //     return this.editor.selections;
    // }
    public set selections(selections: vscode.Selection[]) {
        this.editor.selections = selections;
    }

    public get maxPosition(): number {
        return this.document.offsetAt(new vscode.Position(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER));
    }

    public previewCursorOffset(offset?: string): boolean {
        let [ newOffset, isRelative ] = getOptionalNumber(offset);
        let success = false;

        if (newOffset !== undefined) {
            // Show an outline of where the cursor would be placed, and make it visible.
            if (isRelative) {
                newOffset! += this.originalCursorOffset;
            }
            if (newOffset !== this.cursorOffset) {
                let newPosition = this.document.positionAt(newOffset);
                // this.editor.selection = new vscode.Selection(newPosition, newPosition);
                this.cachedSelections[0] = new vscode.Selection(newPosition, newPosition);
                this.editor.selections = this.cachedSelections;
            }
            success = true;
        }
        const range = new vscode.Range(this.cursor, this.cursor.translate(0, 1));
        this.editor.setDecorations(CursorManager.cursorPositionDecoration, [range]);
        this.reveal();
        return success;
    }

    public commit() {
        this.clearDecorations();
        this.editor.selection = this.cachedSelections[0];
        vscode.window.showTextDocument(this.document, { selection: this.cachedSelections[0] });
    }

    public abort() {
        this.clearDecorations();
        this.cachedSelections.splice(0,1);
        this.editor.selections = this.cachedSelections;
        this.reveal();
    }

    private clearDecorations(): void {
        this.editor.setDecorations(CursorManager.cursorPositionDecoration, []);
    }

    private reveal(revealType?: vscode.TextEditorRevealType): void {
        revealType = revealType || vscode.TextEditorRevealType.InCenterIfOutsideViewport;
        this.editor.revealRange(this.editor.selection, revealType);
    }
}
