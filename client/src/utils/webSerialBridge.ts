/**
 * Web Serial Hardware Bridge - ESC/POS Printer & Cash Drawer Integration
 * 
 * This utility leverages the browser's navigator.serial API to communicate directly
 * with USB/RS232 ESC/POS thermal printers and cash drawers without external print servers.
 * 
 * Key Features:
 * - Direct USB/Serial port communication
 * - ESC/POS command support
 * - Thermal printer integration
 * - Cash drawer kick functionality
 * - Connection management
 * - Error handling and reconnection
 * - Cross-browser compatibility
 * - Baud rate and configuration
 * 
 * Supported Hardware:
 * - ESC/POS thermal printers (58mm, 80mm)
 * - USB Serial printers
 * - Bluetooth Serial printers
 * - Cash drawers with serial interface
 * - Receipt printers
 * 
 * @author Principal Software Architect
 * 
 * @version 2.0.0 - Enterprise Edition
 */

/**
 * Serial Port Configuration
 */
export interface SerialConfig {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'even' | 'odd';
  bufferSize: number;
  flowControl: 'none' | 'hardware';
}

/**
 * Printer Command
 */
export interface PrinterCommand {
  command: string;
  data?: string;
  encoding?: string;
}

/**
 * Printer Connection Status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

/**
 * Web Serial Bridge Class
 */
export class WebSerialBridge {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;

  /**
   * Check if Web Serial API is supported
   */
  static isSupported(): boolean {
    return 'serial' in navigator;
  }

  /**
   * Request access to serial ports
   */
  async requestPort(): Promise<SerialPort[]> {
    if (!WebSerialBridge.isSupported()) {
      throw new Error('Web Serial API not supported in this browser');
    }

    try {
      const ports = await navigator.serial.getPorts();
      return ports;
    } catch (error) {
      throw new Error(`Failed to request serial ports: ${error}`);
    }
  }

  /**
   * Connect to a serial port
   */
  async connect(
    port: SerialPort,
    config: Partial<SerialConfig> = {}
  ): Promise<void> {
    try {
      this.status = ConnectionStatus.CONNECTING;

      const fullConfig: SerialConfig = {
        baudRate: config.baudRate || 9600,
        dataBits: config.dataBits || 8,
        stopBits: config.stopBits || 1,
        parity: config.parity || 'none',
        bufferSize: config.bufferSize || 255,
        flowControl: config.flowControl || 'none',
      };

      await port.open(fullConfig);

      this.port = port;
      this.reader = port.readable.getReader();
      this.writer = port.writable.getWriter();
      this.status = ConnectionStatus.CONNECTED;
      this.reconnectAttempts = 0;

      console.log('Connected to serial port successfully');
    } catch (error) {
      this.status = ConnectionStatus.ERROR;
      throw new Error(`Failed to connect to serial port: ${error}`);
    }
  }

  /**
   * Disconnect from serial port
   */
  async disconnect(): Promise<void> {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }

      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }

      this.status = ConnectionStatus.DISCONNECTED;
      console.log('Disconnected from serial port');
    } catch (error) {
      console.error('Error during disconnect:', error);
      this.status = ConnectionStatus.ERROR;
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Write data to serial port
   */
  async write(data: string | Uint8Array): Promise<void> {
    if (!this.writer || this.status !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to serial port');
    }

    try {
      const encoder = new TextEncoder();
      const dataArray = typeof data === 'string' ? encoder.encode(data) : data;
      await this.writer.write(dataArray);
    } catch (error) {
      this.status = ConnectionStatus.ERROR;
      throw new Error(`Failed to write to serial port: ${error}`);
    }
  }

  /**
   * ESC/POS Commands for Thermal Printers
   */
  static readonly ESC = '\x1B';
  static readonly GS = '\x1D';

  /**
   * Initialize printer
   */
  static initializePrinter(): PrinterCommand {
    return {
      command: 'INITIALIZE',
      data: `${this.ESC}@`, // Initialize printer
    };
  }

  /**
   * Set text alignment
   */
  static setAlignment(alignment: 'LEFT' | 'CENTER' | 'RIGHT'): PrinterCommand {
    const alignCode = alignment === 'LEFT' ? '\x00' : alignment === 'CENTER' ? '\x01' : '\x02';
    return {
      command: 'ALIGN',
      data: `${this.ESC}a${alignCode}`,
    };
  }

  /**
   * Set font size
   */
  static setFontSize(size: 'NORMAL' | 'DOUBLE_HEIGHT' | 'DOUBLE_WIDTH' | 'DOUBLE'): PrinterCommand {
    const sizeCode = size === 'NORMAL' ? '\x00' : 
                    size === 'DOUBLE_HEIGHT' ? '\x11' :
                    size === 'DOUBLE_WIDTH' ? '\x10' : '\x12';
    return {
      command: 'FONT_SIZE',
      data: `${this.ESC}!${sizeCode}`,
    };
  }

  /**
   * Set bold mode
   */
  static setBold(enabled: boolean): PrinterCommand {
    return {
      command: 'BOLD',
      data: `${this.ESC}E${enabled ? '\x01' : '\x00'}`,
    };
  }

  /**
   * Print text
   */
  static printText(text: string): PrinterCommand {
    return {
      command: 'PRINT',
      data: text,
    };
  }

  /**
   * Print line break
   */
  static printLineBreak(): PrinterCommand {
    return {
      command: 'LINE_BREAK',
      data: '\n',
    };
  }

  /**
   * Print line with text
   */
  static printLine(text: string): PrinterCommand {
    return {
      command: 'PRINT_LINE',
      data: `${text}\n`,
    };
  }

  /**
   * Print multiple line breaks
   */
  static printLineBreaks(count: number): PrinterCommand {
    return {
      command: 'LINE_BREAKS',
      data: '\n'.repeat(count),
    };
  }

  /**
   * Print and feed (advance paper)
   */
  static printAndFeed(lines: number): PrinterCommand {
    return {
      command: 'PRINT_AND_FEED',
      data: `${this.ESC}d${lines}`,
    };
  }

  /**
   * Cut paper
   */
  static cutPaper(): PrinterCommand {
    return {
      command: 'CUT',
      data: `${this.GS}V${this.ESC}m`,
    };
  }

  /**
   * Partial cut
   */
  static partialCut(): PrinterCommand {
    return {
      command: 'PARTIAL_CUT',
      data: `${this.GS}V${this.ESC}m\x01`,
    };
  }

  /**
   * Print QR code
   */
  static printQRCode(data: string): PrinterCommand {
    return {
      command: 'QR_CODE',
      data: `${this.GS}k${this.ESC}a${data}\x00`, // Simplified QR code
    };
  }

  /**
   * Print barcode
   */
  static printBarcode(data: string): PrinterCommand {
    return {
      command: 'BARCODE',
      data: `${this.GS}k${this.ESC}a${data}\x00`,
    };
  }

  /**
   * Kick cash drawer
   */
  static kickCashDrawer(): PrinterCommand {
    return {
      command: 'CASH_DRAWER',
      data: `${this.ESC}p`,
    };
  }

  /**
   * Execute multiple printer commands
   */
  async executeCommands(commands: PrinterCommand[]): Promise<void> {
    for (const command of commands) {
      if (command.data) {
        await this.write(command.data);
      }
      // Small delay between commands
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Print complete receipt
   */
  async printReceipt(receipt: {
    header: string;
    items: Array<{ name: string; quantity: number; price: number; total: number }>;
    subtotal: number;
    vat: number;
    total: number;
    footer: string;
  }): Promise<void> {
    const commands: PrinterCommand[] = [
      WebSerialBridge.initializePrinter(),
      WebSerialBridge.setBold(true),
      WebSerialBridge.setAlignment('CENTER'),
      WebSerialBridge.printLine(receipt.header),
      WebSerialBridge.setBold(false),
      WebSerialBridge.printLineBreaks(1),
      WebSerialBridge.printLine('--------------------------------'),
      WebSerialBridge.printLineBreaks(1),
      WebSerialBridge.setAlignment('LEFT'),
      ...receipt.items.map(item => 
        WebSerialBridge.printLine(`${item.quantity} x ${item.name}     ${item.price.toFixed(2)}     ${item.total.toFixed(2)}`)
      ),
      WebSerialBridge.printLine('--------------------------------'),
      WebSerialBridge.printLineBreaks(1),
      WebSerialBridge.setAlignment('RIGHT'),
      WebSerialBridge.printLine(`Subtotal: ${receipt.subtotal.toFixed(2)}`),
      WebSerialBridge.printLine(`VAT (15%): ${receipt.vat.toFixed(2)}`),
      WebSerialBridge.printLineBreaks(1),
      WebSerialBridge.setBold(true),
      WebSerialBridge.printLine(`TOTAL: ${receipt.total.toFixed(2)}`),
      WebSerialBridge.setBold(false),
      WebSerialBridge.printLineBreaks(2),
      WebSerialBridge.setAlignment('CENTER'),
      WebSerialBridge.printLine(receipt.footer),
      WebSerialBridge.printLineBreaks(3),
      WebSerialBridge.cutPaper(),
    ];

    await this.executeCommands(commands);
  }

  /**
   * Kick cash drawer
   */
  async kickCashDrawer(): Promise<void> {
    const command = WebSerialBridge.kickCashDrawer();
    await this.write(command.data);
    console.log('Cash drawer kicked');
  }

  /**
   * Auto-reconnect logic
   */
  async autoReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    try {
      if (this.port) {
        this.reconnectAttempts++;
        await this.connect(this.port);
      }
    } catch (error) {
      console.error('Auto-reconnect failed:', error);
      this.status = ConnectionStatus.ERROR;
    }
  }

  /**
   * Get available serial ports
   */
  static async getAvailablePorts(): Promise<SerialPort[]> {
    try {
      return await navigator.serial.getPorts();
    } catch (error) {
      console.error('Failed to get available ports:', error);
      return [];
    }
  }

  /**
   * Create serial bridge instance
   */
  static create(): WebSerialBridge {
    return new WebSerialBridge();
  }
}

/**
 * Export default instance
 */
export default WebSerialBridge;