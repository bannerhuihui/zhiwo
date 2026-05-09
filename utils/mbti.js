function buildMbtiType(answers) {
  const counts = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }
  ;(answers || []).forEach((letter) => {
    if (counts[letter] != null) counts[letter] += 1
  })
  const EI = counts.E >= counts.I ? 'E' : 'I'
  const SN = counts.S >= counts.N ? 'S' : 'N'
  const TF = counts.T >= counts.F ? 'T' : 'F'
  const JP = counts.J >= counts.P ? 'J' : 'P'
  return { type: `${EI}${SN}${TF}${JP}`, counts }
}

module.exports = { buildMbtiType }
