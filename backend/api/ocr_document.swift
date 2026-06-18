import AppKit
import Foundation
import PDFKit
import Vision

func cgImage(from image: NSImage) -> CGImage? {
    var rect = NSRect(origin: .zero, size: image.size)
    return image.cgImage(forProposedRect: &rect, context: nil, hints: nil)
}

func recognizeText(in image: CGImage) throws -> String {
    var recognizedLines: [String] = []
    let request = VNRecognizeTextRequest { request, _ in
        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            return
        }
        recognizedLines.append(contentsOf: observations.compactMap { observation in
            observation.topCandidates(1).first?.string
        })
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.minimumTextHeight = 0.008

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])
    return recognizedLines.joined(separator: "\n")
}

func renderPdfPage(_ page: PDFPage) -> CGImage? {
    let pageRect = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2.6
    let imageSize = NSSize(width: pageRect.width * scale, height: pageRect.height * scale)
    let image = NSImage(size: imageSize)

    image.lockFocus()
    guard let context = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        return nil
    }
    NSColor.white.setFill()
    context.fill(CGRect(origin: .zero, size: imageSize))
    context.saveGState()
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()
    image.unlockFocus()

    return cgImage(from: image)
}

let arguments = CommandLine.arguments
guard arguments.count == 2 else {
    FileHandle.standardError.write("Usage: ocr_document.swift <path>\n".data(using: .utf8)!)
    exit(2)
}

let url = URL(fileURLWithPath: arguments[1])
var output: [String] = []

if let pdf = PDFDocument(url: url), pdf.pageCount > 0 {
    for index in 0..<pdf.pageCount {
        guard let page = pdf.page(at: index), let image = renderPdfPage(page) else {
            continue
        }
        if let pageText = try? recognizeText(in: image), !pageText.isEmpty {
            output.append(pageText)
        }
    }
} else if let image = NSImage(contentsOf: url), let cgImage = cgImage(from: image) {
    if let imageText = try? recognizeText(in: cgImage), !imageText.isEmpty {
        output.append(imageText)
    }
}

print(output.joined(separator: "\n"))
