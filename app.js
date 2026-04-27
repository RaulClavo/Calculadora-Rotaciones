(() => {
  const matrix_count = 3;
  const default_size = 3;

  const matrices_container = document.getElementById("matrices-container");
  const symbolic_result_el = document.getElementById("symbolic-result");
  const numeric_result_el = document.getElementById("numeric-result");
  const variables_container = document.getElementById("variables-container");

  const matrix_cards = [];
  let symbolic_result_matrix = null;

  function is_number(text) {
    return text !== "" && Number.isFinite(Number(text));
  }

  function format_number(value) {
    const rounded_value = Math.round(value);
    if (Math.abs(value - rounded_value) < 1e-12) {
      return String(rounded_value);
    }
    return String(Number(value.toPrecision(10)));
  }

  function multiply_expr(left, right) {
    const left_text = left.trim();
    const right_text = right.trim();

    if (left_text === "0" || right_text === "0") {
      return "0";
    }
    if (left_text === "1") {
      return right_text;
    }
    if (right_text === "1") {
      return left_text;
    }

    if (is_number(left_text) && is_number(right_text)) {
      return format_number(Number(left_text) * Number(right_text));
    }

    const left_has_outer_parens = left_text.startsWith("(") && left_text.endsWith(")");
    const right_has_outer_parens = right_text.startsWith("(") && right_text.endsWith(")");
    const left_safe = !left_has_outer_parens && (left_text.includes("+") || left_text.includes("-")) ? `(${left_text})` : left_text;
    const right_safe = !right_has_outer_parens && (right_text.includes("+") || right_text.includes("-")) ? `(${right_text})` : right_text;
    return `${left_safe}*${right_safe}`;
  }

  function add_expr(terms) {
    const clean_terms = terms.map((item) => item.trim()).filter((item) => item !== "" && item !== "0");
    if (!clean_terms.length) {
      return "0";
    }

    let numeric_sum = 0;
    const symbolic_terms = [];

    for (const term of clean_terms) {
      if (is_number(term)) {
        numeric_sum += Number(term);
      } else {
        symbolic_terms.push(term);
      }
    }

    const output_terms = [];
    if (Math.abs(numeric_sum) > 1e-12) {
      output_terms.push(format_number(numeric_sum));
    }
    output_terms.push(...symbolic_terms);

    return output_terms.length ? output_terms.join(" + ") : "0";
  }

  function multiply_matrix(left_matrix, right_matrix) {
    const size = left_matrix.length;
    const result = Array.from({ length: size }, () => Array.from({ length: size }, () => "0"));

    for (let row_index = 0; row_index < size; row_index += 1) {
      for (let col_index = 0; col_index < size; col_index += 1) {
        const terms = [];
        for (let mid_index = 0; mid_index < size; mid_index += 1) {
          terms.push(multiply_expr(left_matrix[row_index][mid_index], right_matrix[mid_index][col_index]));
        }
        result[row_index][col_index] = add_expr(terms);
      }
    }

    return result;
  }

  function normalize_token(text) {
    const trimmed = text.trim();
    if (/^[+-]?\d*,\d+$/.test(trimmed)) {
      return trimmed.replace(",", ".");
    }

    return trimmed
      .replace(/\bsen([a-zA-Z_][a-zA-Z0-9_]*)\b/g, "sen($1)")
      .replace(/\bsin([a-zA-Z_][a-zA-Z0-9_]*)\b/g, "sin($1)")
      .replace(/\bcos([a-zA-Z_][a-zA-Z0-9_]*)\b/g, "cos($1)")
      .replace(/\btan([a-zA-Z_][a-zA-Z0-9_]*)\b/g, "tan($1)");
  }

  function is_valid_expr(text) {
    return /^[a-zA-Z0-9_+\-*/^().,\s]+$/.test(text);
  }

  function format_symbolic_matrix(matrix) {
    return matrix.map((row) => `[ ${row.join("   ")} ]`).join("\n");
  }

  function format_numeric_matrix(matrix) {
    return matrix
      .map((row) => {
        const line = row.map((value) => value.toFixed(6).padStart(10, " ")).join("  ");
        return `[ ${line} ]`;
      })
      .join("\n");
  }

  function extract_variables(expressions) {
    const token_pattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const blocked_words = new Set(["sen", "sin", "cos", "tan"]);
    const names = new Set();

    for (const expression of expressions) {
      const tokens = expression.match(token_pattern) || [];
      for (const name of tokens) {
        if (!blocked_words.has(name)) {
          names.add(name);
        }
      }
    }

    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }

  function build_rotation_template(size, axis_name, angle_name) {
    if (size <= 1) {
      return [["1"]];
    }

    if (size === 2) {
      return [
        [`cos(${angle_name})`, `-sen(${angle_name})`],
        [`sen(${angle_name})`, `cos(${angle_name})`],
      ];
    }

    const matrix = Array.from({ length: size }, (_, row_index) =>
      Array.from({ length: size }, (_, col_index) => (row_index === col_index ? "1" : "0"))
    );
    const [first_index, second_index] = axis_name === "X" ? [1, 2] : axis_name === "Y" ? [0, 2] : [0, 1];
    matrix[first_index][first_index] = `cos(${angle_name})`;
    matrix[second_index][second_index] = `cos(${angle_name})`;
    matrix[first_index][second_index] = `-sen(${angle_name})`;
    matrix[second_index][first_index] = `sen(${angle_name})`;
    return matrix;
  }

  function apply_size_to_matrix(card, size_text) {
    const parsed_size = Number.parseInt(String(size_text || "").trim(), 10);
    card.size = Number.isFinite(parsed_size) && parsed_size >= 1 ? parsed_size : default_size;

    const template = build_rotation_template(card.size, card.axis_name, card.angle_name);
    card.grid.innerHTML = "";
    card.grid.style.gridTemplateColumns = `repeat(${card.size}, minmax(70px, 1fr))`;
    card.cells = [];

    for (let row_index = 0; row_index < card.size; row_index += 1) {
      const row_inputs = [];
      for (let col_index = 0; col_index < card.size; col_index += 1) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "cell-input";
        input.value = template[row_index][col_index];
        input.setAttribute("aria-label", `Matriz ${card.index + 1}, fila ${row_index + 1}, columna ${col_index + 1}`);
        card.grid.appendChild(input);
        row_inputs.push(input);
      }
      card.cells.push(row_inputs);
    }
  }

  function render_variable_inputs(variable_names) {
    variables_container.innerHTML = "";

    if (!variable_names.length) {
      const empty_note = document.createElement("p");
      empty_note.className = "subtle";
      empty_note.textContent = "No hay variables libres para asignar.";
      variables_container.appendChild(empty_note);
      return;
    }

    for (const name of variable_names) {
      const row = document.createElement("div");
      row.className = "var-row";

      const label = document.createElement("label");
      label.setAttribute("for", `var-${name}`);
      label.textContent = `${name} (grados)`;

      const input = document.createElement("input");
      input.type = "text";
      input.id = `var-${name}`;
      input.className = "var-input";
      input.placeholder = "Ej: 30";
      input.dataset.varName = name;

      row.appendChild(label);
      row.appendChild(input);
      variables_container.appendChild(row);
    }
  }

  function read_matrices() {
    const matrices = [];
    let expected_size = null;

    for (let matrix_index = 0; matrix_index < matrix_cards.length; matrix_index += 1) {
      const card = matrix_cards[matrix_index];
      if (expected_size === null) {
        expected_size = card.size;
      } else if (card.size !== expected_size) {
        throw new Error("Todas las matrices deben tener el mismo grado para poder multiplicarse.");
      }

      const rows = [];
      for (let row_index = 0; row_index < card.size; row_index += 1) {
        const row = [];
        for (let col_index = 0; col_index < card.size; col_index += 1) {
          const raw_value = card.cells[row_index][col_index].value.trim();
          if (!raw_value) {
            throw new Error(`Matriz ${matrix_index + 1}: la celda (${row_index + 1}, ${col_index + 1}) esta vacia.`);
          }

          const normalized = normalize_token(raw_value);
          if (!is_valid_expr(normalized)) {
            throw new Error(`Matriz ${matrix_index + 1}: valor invalido en la celda (${row_index + 1}, ${col_index + 1}).`);
          }
          row.push(normalized);
        }
        rows.push(row);
      }
      matrices.push(rows);
    }

    return matrices;
  }

  function evaluate_expr(expression, values) {
    if (!is_valid_expr(expression)) {
      throw new Error(`Expresion invalida: ${expression}`);
    }

    const prepared = expression.replace(/\^/g, "**");
    const sen = (deg) => Math.sin((Number(deg) * Math.PI) / 180);
    const sin = (deg) => Math.sin((Number(deg) * Math.PI) / 180);
    const cos = (deg) => Math.cos((Number(deg) * Math.PI) / 180);
    const tan = (deg) => Math.tan((Number(deg) * Math.PI) / 180);

    try {
      const fn = new Function(
        ...Object.keys(values),
        "sen",
        "sin",
        "cos",
        "tan",
        `"use strict"; return (${prepared});`
      );
      const result = fn(...Object.values(values), sen, sin, cos, tan);
      if (!Number.isFinite(result)) {
        throw new Error("Resultado numerico invalido");
      }
      return result;
    } catch {
      throw new Error(`No se pudo evaluar: ${expression}`);
    }
  }

  function calculate_symbolic() {
    try {
      const matrices = read_matrices();
      const reversed = [...matrices].reverse();

      let result = reversed[0];
      for (let index = 1; index < reversed.length; index += 1) {
        result = multiply_matrix(result, reversed[index]);
      }

      symbolic_result_matrix = result;
      symbolic_result_el.textContent = format_symbolic_matrix(result);

      const input_expressions = [];
      for (const card of matrix_cards) {
        for (const row of card.cells) {
          for (const input of row) {
            input_expressions.push(input.value.trim());
          }
        }
      }

      const input_vars = extract_variables(input_expressions).filter(
        (name) => !name.startsWith("sen") && !name.startsWith("sin") && !name.startsWith("cos") && !name.startsWith("tan")
      );
      const output_vars = extract_variables(result.flat());
      const variable_names = [...new Set([...input_vars, ...output_vars])].sort((a, b) => a.localeCompare(b, "es"));

      render_variable_inputs(variable_names);
      numeric_result_el.textContent = "Matriz final numerica: pendiente.";
    } catch (error) {
      alert(error.message);
    }
  }

  function calculate_numeric() {
    if (!symbolic_result_matrix) {
      alert("Primero calcula el resultado simbolico.");
      return;
    }

    try {
      const inputs = variables_container.querySelectorAll("input[data-var-name]");
      const values = {};

      for (const input of inputs) {
        const variable_name = input.dataset.varName;
        const raw_value = input.value.trim().replace(",", ".");
        if (!raw_value) {
          throw new Error(`Falta asignar un angulo para '${variable_name}'.`);
        }
        if (!/^[-+]?\d+(\.\d+)?$/.test(raw_value)) {
          throw new Error(`El valor de '${variable_name}' debe ser numerico.`);
        }
        values[variable_name] = Number(raw_value);
      }

      const evaluated = symbolic_result_matrix.map((row) => row.map((expression) => evaluate_expr(expression, values)));
      numeric_result_el.textContent = format_numeric_matrix(evaluated);
    } catch (error) {
      alert(error.message);
    }
  }

  function create_matrix_card(index) {
    const card = document.createElement("article");
    card.className = "matrix-card";

    const top = document.createElement("div");
    top.className = "matrix-top";

    const title = document.createElement("h3");
    title.className = "matrix-title";
    title.textContent = `Matriz ${index + 1}`;

    const degree_wrap = document.createElement("div");
    degree_wrap.className = "degree-wrap";

    const degree_label = document.createElement("label");
    degree_label.textContent = "Grado";
    degree_label.setAttribute("for", `deg-${index}`);

    const degree_input = document.createElement("input");
    degree_input.id = `deg-${index}`;
    degree_input.type = "number";
    degree_input.min = "1";
    degree_input.step = "1";
    degree_input.className = "degree-input";
    degree_input.value = String(default_size);

    degree_wrap.appendChild(degree_label);
    degree_wrap.appendChild(degree_input);
    top.appendChild(title);
    top.appendChild(degree_wrap);

    const grid = document.createElement("div");
    grid.className = "matrix-grid";

    const card_state = {
      index,
      axis_name: index % 3 === 0 ? "X" : index % 3 === 1 ? "Y" : "Z",
      angle_name: index % 3 === 0 ? "A" : index % 3 === 1 ? "V" : "O",
      size: default_size,
      grid,
      cells: [],
    };

    degree_input.addEventListener("input", () => {
      apply_size_to_matrix(card_state, degree_input.value);
    });

    apply_size_to_matrix(card_state, degree_input.value);
    card.appendChild(top);
    card.appendChild(grid);
    matrix_cards.push(card_state);
    return card;
  }

  function render_matrix_cards() {
    matrices_container.innerHTML = "";
    matrix_cards.length = 0;

    for (let index = 0; index < matrix_count; index += 1) {
      matrices_container.appendChild(create_matrix_card(index));
    }
  }

  function init_app() {
    render_matrix_cards();
    document.getElementById("calc-symbolic").addEventListener("click", calculate_symbolic);
    document.getElementById("calc-numeric").addEventListener("click", calculate_numeric);
  }

  init_app();
})();
